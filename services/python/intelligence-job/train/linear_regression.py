"""Linear Regression Traversal Time ML Pipeline for EcoTransit.

Implements the complete lifecycle:
1. Streaming raw GPS ping cleaning & deduplication (cleaned_pings.csv)
2. GTFS static geometry & 25m stop clustering (static_route_segments.csv, stop_clustering_map.csv)
3. Trajectory crossing extraction & interpolation (traversal_samples.csv)
4. Time feature engineering in IST (featurized_traversal_samples.csv)
5. Chronological train/test split, Linear Regression fit, evaluation, and artifact serialization.

Satisfies inference interface:
    model = joblib.load("models/linear_regression/model.joblib")
    per_segment = model.predict(ahead_df)
    eta_seconds = per_segment.sum()
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import math
import sys
from collections import defaultdict
from datetime import UTC, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.base import BaseEstimator, RegressorMixin
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("linear_regression_pipeline")

# Constants
EARTH_RADIUS_METERS = 6371000.0
IST_OFFSET_SECONDS = 19800  # UTC + 5:30
DELHI_BBOX = {
    "min_lat": 28.30,
    "max_lat": 28.95,
    "min_lon": 76.80,
    "max_lon": 77.55,
}
MAX_PLAUSIBLE_SPEED_KMH = 80.0
MIN_PLAUSIBLE_SPEED_KMH = 1.0
MAX_BRACKETING_GAP_SECONDS = 120.0
MAX_BRACKETING_GAP_METERS = 500.0
STOP_RADIUS_METERS = 50.0
CLUSTER_RADIUS_METERS = 25.0


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes great-circle distance between two GPS coordinates in meters."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2.0) ** 2
    return 2.0 * EARTH_RADIUS_METERS * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


# =====================================================================
# STEP 1: CLEANING RAW PINGS (STREAMING CHUNKS)
# =====================================================================

def clean_pings_stream(
    raw_csv_path: Path,
    output_cleaned_csv: Path,
    chunk_size: int = 100_000,
    max_rows: int | None = None,
) -> int:
    """Streams and cleans raw GPS pings from combined_otd_data.csv.

    - Drops rows with null latitude/longitude or vehicle_id
    - Enforces NCR bounding box
    - Deduplicates on (vehicle_id, vehicle_timestamp)
    - Uses vehicle_timestamp as authoritative time of truth
    - Drops entity_id, vehicle_label, license_plate, file_source, speed
    """
    logger.info(f"--- Step 1: Cleaning Pings from {raw_csv_path.name} ---")
    output_cleaned_csv.parent.mkdir(parents=True, exist_ok=True)

    total_read = 0
    total_written = 0
    seen_pings: set[tuple[str, int]] = set()

    fieldnames = ["vehicle_id", "trip_id", "route_id", "direction_id", "latitude", "longitude", "vehicle_timestamp"]

    with open(output_cleaned_csv, "w", newline="", encoding="utf-8") as out_f:
        writer = csv.DictWriter(out_f, fieldnames=fieldnames)
        writer.writeheader()

        chunks = pd.read_csv(
            raw_csv_path,
            chunksize=chunk_size,
            dtype={
                "vehicle_id": str,
                "trip_id": str,
                "route_id": str,
                "direction_id": str,
                "latitude": float,
                "longitude": float,
                "vehicle_timestamp": "Int64",
            },
            usecols=[
                "vehicle_id",
                "trip_id",
                "route_id",
                "direction_id",
                "latitude",
                "longitude",
                "vehicle_timestamp",
            ],
            low_memory=False,
        )

        for chunk_idx, chunk in enumerate(chunks):
            total_read += len(chunk)

            # 1. Drop missing coordinates or vehicle_id or timestamp
            chunk = chunk.dropna(subset=["latitude", "longitude", "vehicle_id", "vehicle_timestamp"])

            # 2. Bounding-box filter (Delhi NCR)
            in_bbox = (
                (chunk["latitude"] >= DELHI_BBOX["min_lat"])
                & (chunk["latitude"] <= DELHI_BBOX["max_lat"])
                & (chunk["longitude"] >= DELHI_BBOX["min_lon"])
                & (chunk["longitude"] <= DELHI_BBOX["max_lon"])
            )
            chunk = chunk[in_bbox]

            # 3. Deduplicate on (vehicle_id, vehicle_timestamp)
            chunk = chunk.drop_duplicates(subset=["vehicle_id", "vehicle_timestamp"])

            # 4. Filter against global seen set for cross-chunk deduplication
            vids = chunk["vehicle_id"].astype(str).str.strip().to_numpy().tolist()
            vtss = chunk["vehicle_timestamp"].to_numpy(dtype="int64").tolist()
            tids = chunk["trip_id"].to_numpy().tolist()
            rids = chunk["route_id"].to_numpy().tolist()
            dids = chunk["direction_id"].to_numpy().tolist()
            lats = chunk["latitude"].to_numpy(dtype="float64").tolist()
            lons = chunk["longitude"].to_numpy(dtype="float64").tolist()

            valid_rows = []
            for vid, vts, tid, rid, did, lat, lon in zip(vids, vtss, tids, rids, dids, lats, lons, strict=False):
                if not vid or vts <= 0:
                    continue
                key = (vid, vts)
                if key in seen_pings:
                    continue
                seen_pings.add(key)

                valid_rows.append({
                    "vehicle_id": vid,
                    "trip_id": str(tid).strip() if pd.notna(tid) else "",
                    "route_id": str(rid).strip() if pd.notna(rid) else "",
                    "direction_id": str(did).strip() if pd.notna(did) else "0",
                    "latitude": round(lat, 6),
                    "longitude": round(lon, 6),
                    "vehicle_timestamp": vts,
                })
            if valid_rows:
                writer.writerows(valid_rows)
                total_written += len(valid_rows)

            if (chunk_idx + 1) % 10 == 0:
                logger.info(f"Processed {total_read:,} raw pings -> {total_written:,} clean pings kept")

            if max_rows and total_read >= max_rows:
                logger.info(f"Reached max_rows limit ({max_rows:,}) for Step 1.")
                break

    logger.info(f"Step 1 Complete: {total_read:,} raw pings -> {total_written:,} clean pings saved to {output_cleaned_csv.name}")
    return total_written


# =====================================================================
# STEP 2: GTFS STATIC GEOMETRY & 25m STOP CLUSTERING
# =====================================================================

class DisjointSetUnion:
    """Disjoint Set Union (DSU) for spatial clustering."""
    def __init__(self) -> None:
        self.parent: dict[str, str] = {}

    def find(self, i: str) -> str:
        if i not in self.parent:
            self.parent[i] = i
            return i
        if self.parent[i] == i:
            return i
        self.parent[i] = self.find(self.parent[i])
        return self.parent[i]

    def union(self, i: str, j: str) -> None:
        root_i = self.find(i)
        root_j = self.find(j)
        if root_i != root_j:
            # Deterministic: smaller id is root
            if root_i < root_j:
                self.parent[root_j] = root_i
            else:
                self.parent[root_i] = root_j


def build_gtfs_geometry_and_clusters(
    seeds_dir: Path,
    output_clusters_csv: Path,
    output_segments_csv: Path,
    cluster_radius_m: float = CLUSTER_RADIUS_METERS,
) -> tuple[dict[str, str], pd.DataFrame]:
    """Builds stop clusters and canonical route segments from static GTFS files."""
    logger.info("--- Step 2: GTFS Static Geometry & 25m Stop Clustering ---")
    stops_file = seeds_dir / "stops.txt"
    trips_file = seeds_dir / "trips.txt"
    stop_times_file = seeds_dir / "stop_times.txt"

    # 1. Load stops and cluster duplicates within 25 meters
    stops_df = pd.read_csv(stops_file, dtype={"stop_id": str, "stop_name": str})
    logger.info(f"Loaded {len(stops_df):,} stops from {stops_file.name}")

    # Spatial grid bucketing (~25m cells ~ 0.00025 deg)
    grid_size = 0.00025
    grid: dict[tuple[int, int], list[tuple[str, float, float]]] = defaultdict(list)
    stop_coords: dict[str, tuple[float, float, str]] = {}

    for _, row in stops_df.iterrows():
        sid = str(row["stop_id"])
        lat = float(row["stop_lat"])
        lon = float(row["stop_lon"])
        name = str(row["stop_name"])
        stop_coords[sid] = (lat, lon, name)
        gx = int(lat / grid_size)
        gy = int(lon / grid_size)
        grid[(gx, gy)].append((sid, lat, lon))

    dsu = DisjointSetUnion()
    for (gx, gy), cell_stops in grid.items():
        # Check current cell and 8 neighboring cells
        neighbor_stops = []
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                neighbor_stops.extend(grid.get((gx + dx, gy + dy), []))

        for sid1, lat1, lon1 in cell_stops:
            for sid2, lat2, lon2 in neighbor_stops:
                if sid1 < sid2:
                    dist = haversine_distance(lat1, lon1, lat2, lon2)
                    if dist <= cluster_radius_m:
                        dsu.union(sid1, sid2)

    # Compute canonical cluster map and centroid coordinates
    cluster_members: dict[str, list[str]] = defaultdict(list)
    stop_to_cluster: dict[str, str] = {}
    for sid in stop_coords:
        root = dsu.find(sid)
        stop_to_cluster[sid] = root
        cluster_members[root].append(sid)

    cluster_centroids: dict[str, tuple[float, float, str]] = {}
    cluster_rows = []
    for root, members in cluster_members.items():
        avg_lat = sum(stop_coords[m][0] for m in members) / len(members)
        avg_lon = sum(stop_coords[m][1] for m in members) / len(members)
        canonical_name = stop_coords[root][2]
        cluster_centroids[root] = (avg_lat, avg_lon, canonical_name)
        for m in members:
            cluster_rows.append({
                "raw_stop_id": m,
                "cluster_id": root,
                "canonical_name": canonical_name,
                "cluster_lat": avg_lat,
                "cluster_lon": avg_lon,
            })

    clusters_df = pd.DataFrame(cluster_rows)
    output_clusters_csv.parent.mkdir(parents=True, exist_ok=True)
    clusters_df.to_csv(output_clusters_csv, index=False)
    logger.info(f"Collapsed {len(stops_df):,} stops into {len(cluster_members):,} canonical clusters (saved {output_clusters_csv.name})")

    # 2. Build Route Segments from trips and stop_times
    logger.info("Reading trips.txt and stop_times.txt to build canonical route segments...")
    trip_to_route: dict[str, str] = {}
    with open(trips_file, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            trip_to_route[row["trip_id"]] = row["route_id"]

    # We only need one representative trip per route to extract the canonical stop sequence
    route_trip_sample: dict[str, str] = {}
    for tid, rid in trip_to_route.items():
        if rid not in route_trip_sample:
            route_trip_sample[rid] = tid

    # Read stop times for sampled trips
    trip_stops: dict[str, list[tuple[int, str]]] = defaultdict(list)
    with open(stop_times_file, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            tid = row["trip_id"]
            if tid in trip_to_route:
                trip_stops[tid].append((int(row["stop_sequence"]), row["stop_id"]))

    segment_rows = []
    segment_id_counter = 1
    seen_segments: set[tuple[str, str, str]] = set()

    for rid, tid in route_trip_sample.items():
        stops_seq = sorted(trip_stops.get(tid, []), key=lambda x: x[0])
        if len(stops_seq) < 2:
            continue

        # Map to canonical cluster stops and deduplicate consecutive identical stops
        clustered_seq = []
        for _, raw_sid in stops_seq:
            cid = stop_to_cluster.get(raw_sid, raw_sid)
            if not clustered_seq or clustered_seq[-1] != cid:
                clustered_seq.append(cid)

        for i in range(len(clustered_seq) - 1):
            from_cid = clustered_seq[i]
            to_cid = clustered_seq[i + 1]
            seg_key = (rid, from_cid, to_cid)
            if seg_key in seen_segments:
                continue
            seen_segments.add(seg_key)

            from_lat, from_lon, _ = cluster_centroids.get(from_cid, stop_coords.get(from_cid, (0.0, 0.0, "")))
            to_lat, to_lon, _ = cluster_centroids.get(to_cid, stop_coords.get(to_cid, (0.0, 0.0, "")))
            dist_m = haversine_distance(from_lat, from_lon, to_lat, to_lon)

            # Avoid degenerate zero-distance segments
            if dist_m < 15.0:
                dist_m = 15.0

            segment_rows.append({
                "segment_id": segment_id_counter,
                "route_id": rid,
                "direction_id": "0",
                "sequence": i,
                "from_stop_id": from_cid,
                "to_stop_id": to_cid,
                "distance_meters": round(dist_m, 2),
            })
            segment_id_counter += 1

    segments_df = pd.DataFrame(segment_rows)
    segments_df.to_csv(output_segments_csv, index=False)
    logger.info(f"Built {len(segments_df):,} canonical route segments (saved {output_segments_csv.name})")

    return stop_to_cluster, segments_df


# =====================================================================
# STEP 3: CROSSING EXTRACTION & INTERPOLATION
# =====================================================================

def project_stop_on_trajectory(
    p1: tuple[float, float, int],
    p2: tuple[float, float, int],
    stop: tuple[float, float],
) -> tuple[float, float] | None:
    """Projects stop coordinate onto ping trajectory line segment.

    Returns:
        (alpha, perp_distance_meters) if alpha is in [0, 1] else None.
    """
    lat1, lon1, _ = p1
    lat2, lon2, _ = p2
    slat, slon = stop

    # Convert to approximate local Cartesian tangent plane (meters)
    # 1 deg lat ~ 111,139 m, 1 deg lon ~ 111,139 * cos(lat) m
    mid_lat = math.radians((lat1 + lat2) / 2.0)
    kx = 111139.0 * math.cos(mid_lat)
    ky = 111139.0

    x1, y1 = lon1 * kx, lat1 * ky
    x2, y2 = lon2 * kx, lat2 * ky
    sx, sy = slon * kx, slat * ky

    dx = x2 - x1
    dy = y2 - y1
    seg_len_sq = dx * dx + dy * dy

    if seg_len_sq < 1.0:
        # Pings at virtually same position
        dist = math.hypot(sx - x1, sy - y1)
        return (0.0, dist) if dist <= STOP_RADIUS_METERS else None

    # Projection parameter alpha
    alpha = ((sx - x1) * dx + (sy - y1) * dy) / seg_len_sq

    # Allow slight margin [-0.1, 1.1] for GPS fuzziness near stops
    if -0.1 <= alpha <= 1.1:
        clamped_alpha = min(max(alpha, 0.0), 1.0)
        proj_x = x1 + clamped_alpha * dx
        proj_y = y1 + clamped_alpha * dy
        perp_dist = math.hypot(sx - proj_x, sy - proj_y)
        return (clamped_alpha, perp_dist)

    return None


def norm_id(val: Any) -> str:
    """Normalizes string and numeric IDs, stripping any inadvertent '.0' float artifacts."""
    s = str(val).strip()
    if s.endswith(".0"):
        s = s[:-2]
    return s


def extract_crossings_stream(
    cleaned_pings_csv: Path,
    static_segments_csv: Path,
    output_traversals_csv: Path,
    stop_clusters_csv: Path,
    max_groups_to_process: int | None = None,
) -> int:
    """Matches vehicle trajectories against route segments and interpolates crossings."""
    logger.info("--- Step 3: Crossing Extraction & Interpolation ---")
    output_traversals_csv.parent.mkdir(parents=True, exist_ok=True)

    # 1. Load static segments and stop cluster coordinates
    segments_df = pd.read_csv(static_segments_csv, dtype=str)
    clusters_df = pd.read_csv(stop_clusters_csv, dtype=str).drop_duplicates(subset=["cluster_id"])
    cluster_coords = {
        norm_id(r["cluster_id"]): (float(r["cluster_lat"]), float(r["cluster_lon"]))
        for _, r in clusters_df.iterrows()
    }

    # Index segments by (route_id, from_stop_id, to_stop_id)
    route_segments_map: dict[tuple[str, str, str], tuple[int, float]] = {}
    # Also index route to ordered stop list
    route_stops_ordered: dict[str, list[str]] = defaultdict(list)

    for _, row in segments_df.sort_values(by=["route_id", "sequence"]).iterrows():
        rid = norm_id(row["route_id"])
        from_id = norm_id(row["from_stop_id"])
        to_id = norm_id(row["to_stop_id"])
        seg_id = int(row["segment_id"])
        dist_m = float(row["distance_meters"])

        route_segments_map[(rid, from_id, to_id)] = (seg_id, dist_m)
        if not route_stops_ordered[rid] or route_stops_ordered[rid][-1] != from_id:
            route_stops_ordered[rid].append(from_id)
        if route_stops_ordered[rid][-1] != to_id:
            route_stops_ordered[rid].append(to_id)

    # 2. Read cleaned pings and group by (vehicle_id, trip_id)
    logger.info("Reading cleaned pings for trajectory grouping...")
    pings_df = pd.read_csv(
        cleaned_pings_csv,
        dtype={
            "vehicle_id": str,
            "trip_id": str,
            "route_id": str,
            "direction_id": str,
            "latitude": float,
            "longitude": float,
            "vehicle_timestamp": int,
        },
    )

    # Sort globally by vehicle and time
    pings_df = pings_df.sort_values(by=["vehicle_id", "vehicle_timestamp"]).reset_index(drop=True)
    logger.info(f"Loaded and sorted {len(pings_df):,} cleaned pings.")

    total_crossings = 0
    traversal_fieldnames = ["segment_id", "distance_meters", "observed_at_epoch", "travel_seconds"]

    with open(output_traversals_csv, "w", newline="", encoding="utf-8") as out_f:
        writer = csv.DictWriter(out_f, fieldnames=traversal_fieldnames)
        writer.writeheader()

        # Group by (vehicle_id, trip_id) per prompt specification:
        # "For each (vehicle_id, trip_id), sort by vehicle_timestamp and work out when the bus passed each stop."
        grouped = pings_df.groupby(["vehicle_id", "trip_id"])
        group_count = 0

        for (_vid, _tid), group in grouped:
            group_count += 1
            if len(group) < 2:
                continue

            rid = norm_id(group["route_id"].iloc[0])
            if not rid or rid not in route_stops_ordered:
                continue

            target_stops = route_stops_ordered[rid]
            pings = list(group[["latitude", "longitude", "vehicle_timestamp"]].sort_values("vehicle_timestamp").itertuples(index=False))
            if len(pings) < 2:
                continue

            # Work out when vehicle passed each stop along the route
            # Map stop_id -> interpolated passing epoch seconds
            stop_passings: dict[str, int] = {}

            for stop_id in target_stops:
                if stop_id not in cluster_coords:
                    continue
                sc = cluster_coords[stop_id]

                best_time: int | None = None
                min_dist = float("inf")

                for i in range(len(pings) - 1):
                    p1 = (pings[i].latitude, pings[i].longitude, pings[i].vehicle_timestamp)
                    p2 = (pings[i + 1].latitude, pings[i + 1].longitude, pings[i + 1].vehicle_timestamp)

                    dt = int(p2[2]) - int(p1[2])
                    if dt <= 0 or dt > MAX_BRACKETING_GAP_SECONDS:
                        continue

                    dx_m = haversine_distance(p1[0], p1[1], p2[0], p2[1])
                    if dx_m > MAX_BRACKETING_GAP_METERS:
                        continue

                    proj = project_stop_on_trajectory(p1, p2, sc)
                    if proj is not None:
                        alpha, perp_dist = proj
                        if perp_dist < 60.0 and perp_dist < min_dist:
                            min_dist = perp_dist
                            interp_t = int(round(p1[2] + alpha * dt))
                            best_time = interp_t

                if best_time is not None:
                    stop_passings[stop_id] = best_time

            # Check consecutive segment crossings
            for i in range(len(target_stops) - 1):
                s_from = target_stops[i]
                s_to = target_stops[i + 1]

                if s_from in stop_passings and s_to in stop_passings:
                    t_from = stop_passings[s_from]
                    t_to = stop_passings[s_to]

                    travel_seconds = t_to - t_from

                    # Filter: target must be crossed strictly after from_stop
                    if travel_seconds <= 0:
                        continue

                    seg_info = route_segments_map.get((rid, s_from, s_to))
                    if not seg_info:
                        continue

                    seg_id, dist_m = seg_info

                    # Dwell time exclusion & Speed sanity checks
                    speed_mps = dist_m / travel_seconds
                    speed_kmh = speed_mps * 3.6

                    if speed_kmh < MIN_PLAUSIBLE_SPEED_KMH or speed_kmh > MAX_PLAUSIBLE_SPEED_KMH:
                        continue

                    writer.writerow({
                        "segment_id": seg_id,
                        "distance_meters": round(dist_m, 2),
                        "observed_at_epoch": t_to,
                        "travel_seconds": round(float(travel_seconds), 2),
                    })
                    total_crossings += 1

            if group_count % 10000 == 0:
                logger.info(f"Processed {group_count:,} trip groups -> {total_crossings:,} valid segment crossings extracted")

            if max_groups_to_process and group_count >= max_groups_to_process:
                break

    logger.info(f"Step 3 Complete: Extracted {total_crossings:,} valid segment crossings -> saved to {output_traversals_csv.name}")
    return total_crossings


# =====================================================================
# STEP 4: TIME FEATURES & NORMALIZATION PREPARATION
# =====================================================================

def engineer_features(
    traversals_csv: Path,
    output_featurized_csv: Path,
) -> tuple[pd.DataFrame, float, float]:
    """Derives IST hour_of_day, day_type, and calculates distance standardization parameters."""
    logger.info("--- Step 4: Time Features & Distance Standardization ---")
    output_featurized_csv.parent.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(traversals_csv)
    if len(df) == 0:
        logger.warning("No traversal samples to featurize.")
        return df, 0.0, 1.0

    # Derive IST datetime from observed_at_epoch (time of arrival at to_stop)
    ist_tz = timezone(timedelta(seconds=IST_OFFSET_SECONDS))
    datetimes_ist = pd.to_datetime(df["observed_at_epoch"], unit="s", utc=True).dt.tz_convert(ist_tz)

    df["hour_of_day"] = datetimes_ist.dt.hour
    day_of_week = datetimes_ist.dt.dayofweek  # 0=Monday, 5=Saturday, 6=Sunday

    # Saturday/Sunday = weekend
    df["day_type"] = np.where(day_of_week >= 5, "weekend", "weekday")

    # Standardize distance_meters: z = (distance - mean) / std
    mean_dist = float(df["distance_meters"].mean())
    std_dist = float(df["distance_meters"].std())
    if std_dist == 0.0 or math.isnan(std_dist):
        std_dist = 1.0

    df["z_distance"] = (df["distance_meters"] - mean_dist) / std_dist

    df.to_csv(output_featurized_csv, index=False)
    logger.info(f"Step 4 Complete: {len(df):,} featurized samples written to {output_featurized_csv.name}")
    logger.info(f"Distance stats: mean={mean_dist:.2f}m, std={std_dist:.2f}m")

    return df, mean_dist, std_dist


# =====================================================================
# STEP 5: LINEAR REGRESSION MODEL, FIT, EVALUATION & PERSISTENCE
# =====================================================================

class LinearRegressionEtaModel(BaseEstimator, RegressorMixin):
    """Scikit-Learn compatible Linear Regression ETA Model.

    Model Equation:
        ŷ = β0 + β_seg(s) + γ_hour(h) + δ * weekend + θ * z_distance

    Supports inference directly via:
        model = joblib.load("model.joblib")
        per_segment = model.predict(ahead_df)
    """

    def __init__(
        self,
        mean_distance: float = 700.0,
        std_distance: float = 400.0,
    ) -> None:
        self.mean_distance = mean_distance
        self.std_distance = std_distance
        self.intercept_: float = 0.0
        self.coef_segment_: dict[int, float] = {}
        self.coef_hour_: dict[int, float] = dict.fromkeys(range(24), 0.0)
        self.coef_weekend_: float = 0.0
        self.coef_distance_: float = 0.0
        self.feature_columns_: list[str] = ["segment_id", "hour_of_day", "day_type", "distance_meters"]
        self.all_segments_: list[int] = []

    def fit(self, X: pd.DataFrame, y: np.ndarray) -> LinearRegressionEtaModel:
        """Fits Ordinary Least Squares parameters over traversal samples."""
        self.all_segments_ = sorted(X["segment_id"].unique())

        # Build design matrix
        n_samples = len(X)
        segment_index = {seg: idx for idx, seg in enumerate(self.all_segments_)}

        # Features: [segments_one_hot (K), hours_one_hot (24), weekend (1), z_distance (1)]
        k_segments = len(self.all_segments_)
        total_cols = k_segments + 24 + 1 + 1

        design_matrix = np.zeros((n_samples, total_cols), dtype=np.float64)

        seg_indices = [segment_index[s] for s in X["segment_id"]]
        hours = X["hour_of_day"].to_numpy(dtype=int)
        weekends = (X["day_type"].isin(["weekend", "saturday", "sunday"]) | (X["day_type"] == 1)).to_numpy(dtype=float)
        distances = X["distance_meters"].to_numpy(dtype=float)
        z_dists = (distances - self.mean_distance) / self.std_distance

        # Populate design matrix
        row_indices = np.arange(n_samples)
        design_matrix[row_indices, seg_indices] = 1.0
        design_matrix[row_indices, k_segments + hours] = 1.0
        design_matrix[row_indices, k_segments + 24] = weekends
        design_matrix[row_indices, k_segments + 24 + 1] = z_dists

        # Fit linear regression
        reg = LinearRegression(fit_intercept=True)
        reg.fit(design_matrix, y)

        self.intercept_ = float(reg.intercept_)

        # Extract coefficients
        for seg, idx in segment_index.items():
            self.coef_segment_[seg] = float(reg.coef_[idx])

        for h in range(24):
            self.coef_hour_[h] = float(reg.coef_[k_segments + h])

        self.coef_weekend_ = float(reg.coef_[k_segments + 24])
        self.coef_distance_ = float(reg.coef_[k_segments + 24 + 1])

        return self

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        """Predicts traversal time in seconds for each input segment row."""
        if not isinstance(X, pd.DataFrame):
            X = pd.DataFrame(X, columns=self.feature_columns_)

        predictions = np.zeros(len(X), dtype=np.float64)

        for i, row in enumerate(X.itertuples(index=False)):
            seg_id = row.segment_id
            hour = int(getattr(row, "hour_of_day", 12))
            day = getattr(row, "day_type", "weekday")
            dist = float(getattr(row, "distance_meters", self.mean_distance))

            is_weekend = (day in ["weekend", "saturday", "sunday"]) or (day == 1)
            z_dist = (dist - self.mean_distance) / self.std_distance

            # ŷ = β0 + β_seg(s) + γ_hour(h) + δ * weekend + θ * z_distance
            y_hat = self.intercept_
            y_hat += self.coef_segment_.get(seg_id, 0.0)  # Graceful fallback for unseen segments
            y_hat += self.coef_hour_.get(hour, 0.0)
            if is_weekend:
                y_hat += self.coef_weekend_
            y_hat += self.coef_distance_ * z_dist

            # Physical lower bound: minimum crossing time 5 seconds
            predictions[i] = max(y_hat, 5.0)

        return predictions


def train_and_evaluate(
    featurized_df: pd.DataFrame,
    output_model_dir: Path,
    test_fraction: float = 0.20,
    _mean_dist: float = 700.0,
    _std_dist: float = 400.0,
) -> tuple[Pipeline, dict[str, Any]]:

    """Performs chronological split, trains scikit-learn Pipeline, and writes reports."""
    logger.info("--- Step 5: Chronological Split, Training, & Evaluation ---")
    output_model_dir.mkdir(parents=True, exist_ok=True)

    # 1. Chronological Split (Earliest 80% train, latest 20% test)
    featurized_df = featurized_df.sort_values(by="observed_at_epoch").reset_index(drop=True)
    n_samples = len(featurized_df)

    split_idx = int(n_samples * (1.0 - test_fraction))
    train_df = featurized_df.iloc[:split_idx]
    test_df = featurized_df.iloc[split_idx:]

    logger.info(f"Split {n_samples:,} rows: {len(train_df):,} Train (80%), {len(test_df):,} Test (20%)")

    # 2. Build and Fit Scikit-Learn Pipeline
    feature_cols = ["segment_id", "hour_of_day", "day_type", "distance_meters"]
    all_segs = sorted(train_df["segment_id"].unique())

    preprocessor = ColumnTransformer(
        transformers=[
            ("segment", OneHotEncoder(categories=[all_segs], handle_unknown="ignore", sparse_output=False), ["segment_id"]),
            ("hour", OneHotEncoder(categories=[list(range(24))], handle_unknown="ignore", sparse_output=False), ["hour_of_day"]),
            ("day", OneHotEncoder(categories=[["weekday", "weekend"]], drop=["weekday"], handle_unknown="ignore", sparse_output=False), ["day_type"]),
            ("distance", StandardScaler(), ["distance_meters"]),
        ]
    )

    model = Pipeline([
        ("preprocessor", preprocessor),
        ("regressor", Ridge(alpha=1.0, fit_intercept=True)),
    ])

    model.fit(train_df[feature_cols], train_df["travel_seconds"])

    # 3. Evaluate Predictions
    y_test = test_df["travel_seconds"].to_numpy()
    y_pred = model.predict(test_df[feature_cols])

    overall_mae = float(mean_absolute_error(y_test, y_pred))
    overall_rmse = float(math.sqrt(mean_squared_error(y_test, y_pred)))

    # Slice evaluation: Off-peak, Morning Peak (8-11), Evening Peak (17-20)
    morning_mask = (test_df["hour_of_day"] >= 8) & (test_df["hour_of_day"] <= 11)
    evening_mask = (test_df["hour_of_day"] >= 17) & (test_df["hour_of_day"] <= 20)
    offpeak_mask = ~(morning_mask | evening_mask)

    def calc_slice_metrics(mask: pd.Series) -> dict[str, float]:
        sub_y = y_test[mask]
        sub_pred = y_pred[mask]
        if len(sub_y) == 0:
            return {"mae": 0.0, "rmse": 0.0, "samples": 0}
        return {
            "mae": round(float(mean_absolute_error(sub_y, sub_pred)), 2),
            "rmse": round(float(math.sqrt(mean_squared_error(sub_y, sub_pred))), 2),
            "samples": int(len(sub_y)),
        }

    metrics = {
        "overall": {"mae": round(overall_mae, 2), "rmse": round(overall_rmse, 2), "samples": len(test_df)},
        "morning_peak": calc_slice_metrics(morning_mask),
        "evening_peak": calc_slice_metrics(evening_mask),
        "off_peak": calc_slice_metrics(offpeak_mask),
    }

    # Baseline: Historical Naive Average per segment
    segment_averages = train_df.groupby("segment_id")["travel_seconds"].mean().to_dict()
    global_avg = float(train_df["travel_seconds"].mean())
    y_baseline = np.array([segment_averages.get(s, global_avg) for s in test_df["segment_id"]])
    baseline_mae = float(mean_absolute_error(y_test, y_baseline))
    baseline_rmse = float(math.sqrt(mean_squared_error(y_test, y_baseline)))

    # 4. Save fitted model pipeline artifact
    model_joblib_path = output_model_dir / "model.joblib"
    joblib.dump(model, model_joblib_path)
    logger.info(f"Saved fitted model artifact to {model_joblib_path}")

    # 5. Extract learned parameters
    reg = model.named_steps["regressor"]
    scaler = model.named_steps["preprocessor"].named_transformers_["distance"]
    intercept_beta0 = float(reg.intercept_)
    coefs = reg.coef_
    k_segs = len(all_segs)
    {str(seg): round(float(c), 3) for seg, c in zip(all_segs, coefs[:k_segs], strict=False)}
    hour_coefs = {str(h): round(float(c), 3) for h, c in enumerate(coefs[k_segs : k_segs + 24])}
    delta_weekend = float(coefs[k_segs + 24])
    theta_distance = float(coefs[k_segs + 25])
    actual_mean_dist = float(scaler.mean_[0])
    actual_std_dist = float(scaler.scale_[0])

    train_start = datetime.fromtimestamp(int(train_df["observed_at_epoch"].min()), tz=UTC).isoformat()
    train_end = datetime.fromtimestamp(int(train_df["observed_at_epoch"].max()), tz=UTC).isoformat()
    test_start = datetime.fromtimestamp(int(test_df["observed_at_epoch"].min()), tz=UTC).isoformat()
    test_end = datetime.fromtimestamp(int(test_df["observed_at_epoch"].max()), tz=UTC).isoformat()

    metadata = {
        "model_name": "LinearRegressionEtaModel",
        "equation": "y_hat = beta0 + beta_seg(s) + gamma_hour(h) + delta * weekend + theta * z_distance",
        "sklearn_version": sklearn.__version__,
        "total_segments_learned": len(all_segs),
        "sample_counts": {
            "train": len(train_df),
            "test": len(test_df),
        },
        "periods": {
            "train_start": train_start,
            "train_end": train_end,
            "test_start": test_start,
            "test_end": test_end,
        },
        "parameters": {
            "intercept_beta0": round(intercept_beta0, 3),
            "delta_weekend": round(delta_weekend, 3),
            "theta_distance": round(theta_distance, 3),
            "hour_coefficients": hour_coefs,
            "mean_distance_meters": round(actual_mean_dist, 2),
            "std_distance_meters": round(actual_std_dist, 2),
        },
        "metrics": metrics,
        "baseline_naive_segment_average": {
            "mae": round(baseline_mae, 2),
            "rmse": round(baseline_rmse, 2),
        },
    }

    metadata_path = output_model_dir / "metadata.json"
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    logger.info(f"Saved model metadata to {metadata_path}")

    # 6. Compare models CSV
    comparison_csv_path = output_model_dir / "model_comparison.csv"
    comp_df = pd.DataFrame([
        {
            "model": "Linear Regression (Ridge)",
            "overall_mae": metrics["overall"]["mae"],
            "overall_rmse": metrics["overall"]["rmse"],
            "morning_peak_mae": metrics["morning_peak"]["mae"],
            "evening_peak_mae": metrics["evening_peak"]["mae"],
            "off_peak_mae": metrics["off_peak"]["mae"],
        },
        {
            "model": "Historical Segment Average",
            "overall_mae": round(baseline_mae, 2),
            "overall_rmse": round(baseline_rmse, 2),
            "morning_peak_mae": "-",
            "evening_peak_mae": "-",
            "off_peak_mae": "-",
        },
    ])
    comp_df.to_csv(comparison_csv_path, index=False)
    logger.info(f"Saved evaluation comparison to {comparison_csv_path}")

    # Print summary
    print("\n" + "=" * 60)
    print("      LINEAR REGRESSION MODEL FIT & EVALUATION REPORT      ")
    print("=" * 60)
    print(f"Learned Parameters: beta0 = {intercept_beta0:.2f}s, delta(weekend) = {delta_weekend:.2f}s, theta(dist) = {theta_distance:.2f}s")
    print(f"Overall Test MAE:   {metrics['overall']['mae']:.2f} s  (vs Baseline: {baseline_mae:.2f} s)")
    print(f"Overall Test RMSE:  {metrics['overall']['rmse']:.2f} s (vs Baseline: {baseline_rmse:.2f} s)")
    print(f"Morning Peak MAE:   {metrics['morning_peak']['mae']:.2f} s")
    print(f"Evening Peak MAE:   {metrics['evening_peak']['mae']:.2f} s")
    print(f"Off-Peak MAE:       {metrics['off_peak']['mae']:.2f} s")
    print("=" * 60 + "\n")

    return model, metadata


# =====================================================================
# PIPELINE RUNNER & CLI
# =====================================================================

def run_pipeline(
    raw_data_file: Path,
    seeds_dir: Path,
    artifacts_dir: Path,
    models_dir: Path,
    step: str = "all",
    resume: bool = True,
    sample_limit: int | None = None,
) -> None:
    """Orchestrates step-by-step stopped execution of the ML pipeline."""
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    models_dir.mkdir(parents=True, exist_ok=True)

    cleaned_csv = artifacts_dir / "cleaned_pings.csv"
    clusters_csv = artifacts_dir / "stop_clustering_map.csv"
    segments_csv = artifacts_dir / "static_route_segments.csv"
    traversals_csv = artifacts_dir / "traversal_samples.csv"
    featurized_csv = artifacts_dir / "featurized_traversal_samples.csv"
    model_output_dir = models_dir / "linear_regression"

    # Step 1: Clean Pings
    if step in ("all", "clean"):
        if resume and cleaned_csv.exists() and cleaned_csv.stat().st_size > 100:
            logger.info(f"Step 1 skipped: Found existing checkpoint {cleaned_csv.name}")
        else:
            clean_pings_stream(raw_data_file, cleaned_csv, max_rows=sample_limit)
        if step == "clean":
            return

    # Step 2: GTFS Geometry & Clusters
    if step in ("all", "geometry"):
        if resume and clusters_csv.exists() and segments_csv.exists() and segments_csv.stat().st_size > 100:
            logger.info("Step 2 skipped: Found existing GTFS geometry checkpoints.")
        else:
            build_gtfs_geometry_and_clusters(seeds_dir, clusters_csv, segments_csv)
        if step == "geometry":
            return

    # Step 3: Extract Crossings
    if step in ("all", "crossings"):
        if resume and traversals_csv.exists() and traversals_csv.stat().st_size > 100:
            logger.info(f"Step 3 skipped: Found existing checkpoint {traversals_csv.name}")
        else:
            extract_crossings_stream(cleaned_csv, segments_csv, traversals_csv, clusters_csv)
        if step == "crossings":
            return

    # Step 4: Time Features
    mean_dist, std_dist = 700.0, 400.0
    if step in ("all", "featurize"):
        if resume and featurized_csv.exists() and featurized_csv.stat().st_size > 100:
            logger.info(f"Step 4 skipped: Found existing checkpoint {featurized_csv.name}")
            f_df = pd.read_csv(featurized_csv)
            mean_dist = float(f_df["distance_meters"].mean())
            std_dist = float(f_df["distance_meters"].std())
        else:
            _, mean_dist, std_dist = engineer_features(traversals_csv, featurized_csv)
        if step == "featurize":
            return

    # Step 5: Train & Evaluate
    if step in ("all", "train"):
        if not featurized_csv.exists() or featurized_csv.stat().st_size <= 100:
            _, mean_dist, std_dist = engineer_features(traversals_csv, featurized_csv)
        featurized_df = pd.read_csv(featurized_csv)
        train_and_evaluate(featurized_df, model_output_dir, mean_dist=mean_dist, std_dist=std_dist)


def main() -> None:
    parser = argparse.ArgumentParser(description="Linear Regression Traversal Time ML Pipeline")
    parser.add_argument(
        "--step",
        choices=["all", "clean", "geometry", "crossings", "featurize", "train"],
        default="all",
        help="Monuments to run (default: all)",
    )
    parser.add_argument("--no-resume", action="store_true", help="Force recalculation instead of resuming checkpoints")
    parser.add_argument("--sample-limit", type=int, default=None, help="Optional row limit on raw data for quick test")
    parser.add_argument(
        "--raw-data",
        default="services/python/intelligence-job/raw-data/combined_otd_data.csv",
        help="Path to raw CSV pings file",
    )
    parser.add_argument(
        "--seeds-dir",
        default="database/seeds",
        help="Path to static GTFS seeds directory",
    )
    parser.add_argument(
        "--artifacts-dir",
        default="services/python/intelligence-job/artifacts",
        help="Directory to save intermediate stopped checkpoints",
    )
    parser.add_argument(
        "--models-dir",
        default="models",
        help="Directory to save trained model artifacts",
    )

    args = parser.parse_args()

    # Resolve paths relative to repo root
    repo_root = Path(__file__).resolve().parents[4]
    raw_path = (repo_root / args.raw_data).resolve()
    seeds_path = (repo_root / args.seeds_dir).resolve()
    artifacts_path = (repo_root / args.artifacts_dir).resolve()
    models_path = (repo_root / args.models_dir).resolve()

    run_pipeline(
        raw_data_file=raw_path,
        seeds_dir=seeds_path,
        artifacts_dir=artifacts_path,
        models_dir=models_path,
        step=args.step,
        resume=not args.no_resume,
        sample_limit=args.sample_limit,
    )


if __name__ == "__main__":
    main()
