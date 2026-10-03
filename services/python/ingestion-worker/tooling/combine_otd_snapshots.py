"""Snapshot Combiner and Cleaner (Appendix A.2).

Flattens every vehicle observation across every collected file into one row,
cleans the result through a 6-stage pipeline, and writes a single CSV for the
Intelligence Job's TrajectoryExtractor.
"""

from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import pandas as pd

logger = logging.getLogger("combine_otd")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

IST_TZ = ZoneInfo("Asia/Kolkata")


def combine_snapshots(
    input_dir: Path | str,
    output_csv: Path | str,
    min_lat: float = 28.30,
    max_lat: float = 28.95,
    min_lon: float = 76.80,
    max_lon: float = 77.55,
) -> pd.DataFrame:
    """Executes the 6-stage cleaning pipeline across all JSON snapshot files."""
    input_path = Path(input_dir)
    json_files = sorted(input_path.glob("*.json"))

    if not json_files:
        logger.warning("No JSON snapshot files found in %s", input_dir)
        df_empty = pd.DataFrame(columns=[
            "source_file", "collected_at", "gtfs_timestamp", "gtfs_datetime_ist",
            "entity_id", "vehicle_id", "vehicle_label", "license_plate",
            "trip_id", "route_id", "direction_id",
            "latitude", "longitude", "bearing", "speed", "is_speed_suspect",
        ])
        df_empty.to_csv(output_csv, index=False)
        return df_empty

    raw_rows: list[dict[str, Any]] = []

    for file_path in json_files:
        try:
            content = json.loads(file_path.read_text(encoding="utf-8"))
            snapshots = content.get("snapshots", [])
            for snap in snapshots:
                collected_at = snap.get("collected_at")
                vehicles = snap.get("vehicles", [])
                for v in vehicles:
                    veh_info = v.get("vehicle", {})
                    trip_info = v.get("trip", {})
                    pos_info = v.get("position", {})

                    raw_rows.append({
                        "source_file": file_path.name,
                        "collected_at": collected_at,
                        "gtfs_timestamp": v.get("timestamp"),
                        "entity_id": v.get("entity_id"),
                        "vehicle_id": veh_info.get("id"),
                        "vehicle_label": veh_info.get("label"),
                        "license_plate": veh_info.get("license_plate"),
                        "trip_id": trip_info.get("trip_id"),
                        "route_id": trip_info.get("route_id"),
                        "direction_id": trip_info.get("direction_id"),
                        "latitude": pos_info.get("latitude"),
                        "longitude": pos_info.get("longitude"),
                        "bearing": pos_info.get("bearing"),
                        "speed": pos_info.get("speed"),
                    })
        except Exception as exc:
            logger.warning("Failed to parse file %s: %s", file_path, exc)

    df = pd.DataFrame(raw_rows)
    initial_count = len(df)
    print("\n--- Delhi OTD Snapshot Combiner Breakdown ---")
    print(f"Initial raw vehicle observations: {initial_count}")

    if df.empty:
        df.to_csv(output_csv, index=False)
        return df

    # Stage 1: Drop rows with no position (latitude / longitude missing or unparseable)
    df["latitude"] = pd.to_numeric(df["latitude"], errors="coerce")
    df["longitude"] = pd.to_numeric(df["longitude"], errors="coerce")
    df = df.dropna(subset=["latitude", "longitude"])
    stage1_count = len(df)
    print(f"Stage 1 (Dropped missing GPS):     {stage1_count} (dropped {initial_count - stage1_count})")

    # Stage 2: Drop rows with no vehicle_id
    df = df[df["vehicle_id"].notna() & (df["vehicle_id"].astype(str).str.strip() != "")]
    stage2_count = len(df)
    print(f"Stage 2 (Dropped missing vehicle_id): {stage2_count} (dropped {stage1_count - stage2_count})")

    # Stage 3: Bounding-box filter (Delhi NCR: 28.30-28.95°N, 76.80-77.55°E)
    in_bbox = (
        (df["latitude"] >= min_lat)
        & (df["latitude"] <= max_lat)
        & (df["longitude"] >= min_lon)
        & (df["longitude"] <= max_lon)
    )
    df = df[in_bbox]
    stage3_count = len(df)
    print(f"Stage 3 (Bounding box filter):       {stage3_count} (dropped {stage2_count - stage3_count})")

    # Stage 4: Deduplicate on (vehicle_id, gtfs_timestamp)
    df["gtfs_timestamp"] = pd.to_numeric(df["gtfs_timestamp"], errors="coerce").fillna(0).astype("int64")
    df = df.drop_duplicates(subset=["vehicle_id", "gtfs_timestamp"], keep="last")
    stage4_count = len(df)
    print(f"Stage 4 (Deduplicate pings):         {stage4_count} (dropped {stage3_count - stage4_count})")

    # Stage 5: Sort by vehicle_id, then gtfs_timestamp
    df = df.sort_values(by=["vehicle_id", "gtfs_timestamp"]).reset_index(drop=True)

    # Derive IST timestamp
    df["gtfs_datetime_ist"] = pd.to_datetime(df["gtfs_timestamp"], unit="s", utc=True).dt.tz_convert(IST_TZ).dt.strftime("%Y-%m-%d %H:%M:%S")

    # Stage 6: Flag, don't drop, suspect speed (speed is null, <= 0, or > 34 m/s ~ 120 km/h)
    df["speed"] = pd.to_numeric(df["speed"], errors="coerce")
    df["bearing"] = pd.to_numeric(df["bearing"], errors="coerce")
    df["is_speed_suspect"] = (df["speed"].isna()) | (df["speed"] <= 0.0) | (df["speed"] > 34.0)

    suspect_count = int(df["is_speed_suspect"].sum())
    print(f"Stage 6 (Flagged suspect speed):     {suspect_count} flagged of {len(df)} total rows")
    print(f"Final output dataset row count:      {len(df)}")
    print("---------------------------------------------\n")

    output_path = Path(output_csv)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_path, index=False)
    logger.info("Saved combined dataset to %s", output_path)

    return df


def main() -> None:
    parser = argparse.ArgumentParser(description="Combine Delhi OTD snapshots into cleaned CSV (Appendix A.2)")
    parser.add_argument("--input-dir", default="otd_data", help="Directory containing raw JSON snapshots")
    parser.add_argument("--output", default="otd_combined.csv", help="Target CSV output path")
    args = parser.parse_args()

    combine_snapshots(input_dir=args.input_dir, output_csv=args.output)


if __name__ == "__main__":
    main()
