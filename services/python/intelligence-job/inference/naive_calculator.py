"""Naive ETA Calculator implementing constant velocity and historical segment averages."""

from __future__ import annotations

import csv
import logging
import os
from pathlib import Path

from .base import BaseETACalculator, CalculationResult, SegmentContext

logger = logging.getLogger("NaiveETACalculator")


class NaiveETACalculator(BaseETACalculator):
    """Computes baseline ETA using historical segment averages and constant velocity."""

    def __init__(
        self,
        default_speed_mps: float | None = None,
        segment_averages_path: Path | str | None = None,
    ) -> None:
        # Default bus speed in Delhi NCR ~ 20 km/h = 5.556 m/s
        env_speed = os.getenv("ETA_NAIVE_DEFAULT_SPEED_MPS")
        if default_speed_mps is not None:
            self.default_speed_mps = float(default_speed_mps)
        elif env_speed is not None:
            self.default_speed_mps = float(env_speed)
        else:
            self.default_speed_mps = 20.0 / 3.6  # 5.556 m/s

        self.segment_averages: dict[str, float] = {}
        self._load_segment_averages(segment_averages_path)

    def _load_segment_averages(self, path: Path | str | None) -> None:
        """Loads historical segment averages from CSV if available."""
        candidate_paths = []
        if path:
            candidate_paths.append(Path(path))

        env_dir = os.getenv("ETA_ARTIFACTS_DIR")
        if env_dir:
            candidate_paths.append(Path(env_dir) / "segment_averages.csv")

        # Standard relative paths
        base_dir = Path(__file__).resolve().parents[1]
        candidate_paths.append(base_dir / "artifacts" / "segment_averages.csv")
        candidate_paths.append(base_dir.parents[2] / "models" / "linear_regression" / "segment_averages.csv")

        for p in candidate_paths:
            if p.exists() and p.is_file():
                try:
                    with open(p, encoding="utf-8") as f:
                        reader = csv.DictReader(f)
                        for row in reader:
                            seg_id = str(row["segment_id"]).strip()
                            avg_sec = float(row.get("avg_travel_seconds", row.get("mean", 0.0)))
                            if avg_sec > 0:
                                self.segment_averages[seg_id] = avg_sec
                    logger.info("Loaded %d historical segment averages from %s", len(self.segment_averages), p)
                    return
                except Exception as e:
                    logger.warning("Could not read segment averages from %s: %s", p, e)

        logger.info("No segment_averages.csv found; operating strictly on velocity heuristics.")

    def calculate_eta(
        self,
        route_id: str,  # noqa: ARG002
        remaining_segments: list[SegmentContext],
        hour_of_day: int,
        day_type: str,
        current_speed_mps: float | None = None,
    ) -> CalculationResult:


        if not remaining_segments:
            return CalculationResult(
                total_eta_seconds=0.0,
                per_segment_eta=[],
                confidence_score=0.5,
                strategy_name="naive_baseline",
            )

        # Peak hours: 08:00 - 11:00 and 17:00 - 20:00 (Delhi NCR congestion)
        is_peak = (8 <= hour_of_day <= 11) or (17 <= hour_of_day <= 20)
        peak_multiplier = 1.35 if (is_peak and day_type == "weekday") else 1.0

        # Effective velocity: prefer bus telemetry speed if reasonable (> 2 m/s), else default
        speed = self.default_speed_mps
        if current_speed_mps is not None and current_speed_mps > 2.0:
            # Blend 50% current speed and 50% default speed for smoothing
            speed = 0.5 * current_speed_mps + 0.5 * self.default_speed_mps

        effective_speed = max(1.5, speed / peak_multiplier)

        per_segment_times: list[float] = []
        known_count = 0

        for seg in remaining_segments:
            s_id = str(seg.segment_id).strip()
            # If historical average is known, apply peak multiplier to it
            if s_id in self.segment_averages:
                seg_time = self.segment_averages[s_id] * (1.15 if is_peak else 0.95)
                known_count += 1
            else:
                seg_time = seg.distance_meters / effective_speed

            # Minimum 5.0 seconds traversal physically
            seg_time = max(5.0, round(seg_time, 2))
            per_segment_times.append(seg_time)

        total_time = round(sum(per_segment_times), 2)
        confidence = 0.75 if (known_count / len(remaining_segments) > 0.5) else 0.60

        return CalculationResult(
            total_eta_seconds=total_time,
            per_segment_eta=per_segment_times,
            confidence_score=confidence,
            strategy_name="naive_baseline",
        )
