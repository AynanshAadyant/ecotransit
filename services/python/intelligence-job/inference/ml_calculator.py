"""Linear Regression ML ETA Calculator leveraging the trained Scikit-Learn Pipeline."""

from __future__ import annotations

import contextlib
import json
import logging
import os
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

from .base import BaseETACalculator, CalculationResult, SegmentContext

logger = logging.getLogger("LinearRegressionETACalculator")


class LinearRegressionETACalculator(BaseETACalculator):
    """Predicts ETA by aggregating per-segment Ridge Linear Regression predictions."""

    def __init__(self, model_dir: Path | str | None = None) -> None:
        self.model_dir = self._resolve_model_dir(model_dir)
        self.model: Any | None = None
        self.metadata: dict[str, Any] = {}
        self.known_segments: set[int] = set()

        self._load_artifacts()

    def _resolve_model_dir(self, explicit_path: Path | str | None) -> Path:
        if explicit_path:
            return Path(explicit_path)

        env_dir = os.getenv("ETA_MODEL_DIR")
        if env_dir:
            return Path(env_dir)

        # Standard repository location: models/linear_regression
        base_dir = Path(__file__).resolve().parents[1]
        repo_root = base_dir.parents[2]
        return repo_root / "models" / "linear_regression"

    def _load_artifacts(self) -> None:
        """Loads serialized model.joblib and metadata.json."""
        model_file = self.model_dir / "model.joblib"
        metadata_file = self.model_dir / "metadata.json"

        if metadata_file.exists():
            try:
                with open(metadata_file, encoding="utf-8") as f:
                    self.metadata = json.load(f)
                logger.info("Loaded model metadata: %s", self.metadata.get("model_name"))
            except Exception as e:
                logger.warning("Failed to parse metadata from %s: %s", metadata_file, e)

        if model_file.exists():
            try:
                self.model = joblib.load(model_file)
                logger.info("Successfully loaded Ridge Linear Regression pipeline from %s", model_file)

                # Extract known segment categories from the pipeline preprocessor if available
                if hasattr(self.model, "named_steps") and "preprocessor" in self.model.named_steps:
                    preprocessor = self.model.named_steps["preprocessor"]
                    seg_transformer = preprocessor.named_transformers_.get("segment")
                    if seg_transformer and hasattr(seg_transformer, "categories_"):
                        for cat in seg_transformer.categories_[0]:
                            with contextlib.suppress(ValueError, TypeError):
                                self.known_segments.add(int(cat))
            except Exception as e:
                logger.error("Failed to deserialize model artifact at %s: %s", model_file, e)
                self.model = None
        else:
            logger.warning("No model.joblib found at %s. Operating in bootstrap mode.", model_file)

    @property
    def is_loaded(self) -> bool:
        return self.model is not None

    def calculate_eta(
        self,
        route_id: str,  # noqa: ARG002
        remaining_segments: list[SegmentContext],
        hour_of_day: int,
        day_type: str,
        current_speed_mps: float | None = None,  # noqa: ARG002
    ) -> CalculationResult:


        if not remaining_segments:
            return CalculationResult(
                total_eta_seconds=0.0,
                per_segment_eta=[],
                confidence_score=0.5,
                strategy_name="linear_regression_ml",
            )

        # Normalize day_type to 'weekday' or 'weekend'
        dt_clean = "weekend" if day_type in ("weekend", "saturday", "sunday", 1, "1") else "weekday"
        hour_clean = max(0, min(23, int(hour_of_day)))

        known_count = 0
        feature_rows: list[dict[str, Any]] = []

        for seg in remaining_segments:
            # Coerce segment_id to int if possible for the OneHotEncoder category matching
            try:
                seg_id_val = int(seg.segment_id)
            except (ValueError, TypeError):
                seg_id_val = seg.segment_id

            if seg_id_val in self.known_segments:
                known_count += 1

            feature_rows.append({
                "segment_id": seg_id_val,
                "hour_of_day": hour_clean,
                "day_type": dt_clean,
                "distance_meters": float(seg.distance_meters),
            })

        df_features = pd.DataFrame(feature_rows)

        if self.model is not None:
            try:
                raw_predictions = self.model.predict(df_features)
                # Physical lower bound: minimum crossing time 5.0 seconds
                clamped_predictions = [max(5.0, round(float(p), 2)) for p in raw_predictions]
                total_eta = round(sum(clamped_predictions), 2)

                # Confidence is higher when more segments were seen during training
                ratio = known_count / max(1, len(remaining_segments))
                confidence = round(0.65 + (0.30 * ratio), 2)

                return CalculationResult(
                    total_eta_seconds=total_eta,
                    per_segment_eta=clamped_predictions,
                    confidence_score=confidence,
                    strategy_name="linear_regression_ml",
                )
            except Exception as e:
                logger.error("Model prediction failure: %s. Falling back to parametric estimate.", e)

        # Parametric fallback using equation parameters from metadata if pipeline failed
        params = self.metadata.get("parameters", {})
        beta0 = float(params.get("intercept_beta0", 138.0))
        delta_wknd = float(params.get("delta_weekend", -35.0))
        theta_dist = float(params.get("theta_distance", 38.0))
        mean_dist = float(params.get("mean_distance_meters", 467.0))
        std_dist = float(params.get("std_distance_meters", 240.0))
        hour_coefs = params.get("hour_coefficients", {})

        gamma_hour = float(hour_coefs.get(str(hour_clean), 0.0))
        is_wknd = 1.0 if dt_clean == "weekend" else 0.0

        fallback_predictions: list[float] = []
        for seg in remaining_segments:
            z_dist = (float(seg.distance_meters) - mean_dist) / max(1.0, std_dist)
            y_hat = beta0 + gamma_hour + (delta_wknd * is_wknd) + (theta_dist * z_dist)
            fallback_predictions.append(max(5.0, round(y_hat, 2)))

        total_eta = round(sum(fallback_predictions), 2)
        return CalculationResult(
            total_eta_seconds=total_eta,
            per_segment_eta=fallback_predictions,
            confidence_score=0.60,
            strategy_name="linear_regression_parametric_fallback",
        )
