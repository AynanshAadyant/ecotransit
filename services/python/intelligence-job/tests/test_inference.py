"""Unit tests for ETA Inference Calculators (Naive and Linear Regression)."""

import sys
from pathlib import Path

import pytest

service_dir = Path(__file__).resolve().parents[1]
if str(service_dir) not in sys.path:
    sys.path.insert(0, str(service_dir))

from inference.base import SegmentContext  # noqa: E402
from inference.ml_calculator import LinearRegressionETACalculator  # noqa: E402
from inference.naive_calculator import NaiveETACalculator  # noqa: E402


def test_naive_calculator_empty_segments():
    calc = NaiveETACalculator()
    res = calc.calculate_eta("142", [], hour_of_day=10, day_type="weekday")
    assert res.total_eta_seconds == 0.0
    assert len(res.per_segment_eta) == 0


def test_naive_calculator_constant_velocity():
    calc = NaiveETACalculator(default_speed_mps=10.0)
    segs = [
        SegmentContext(segment_id=999999, distance_meters=500.0),
        SegmentContext(segment_id=999998, distance_meters=300.0),
    ]
    # Off-peak, weekday
    res = calc.calculate_eta("142", segs, hour_of_day=14, day_type="weekday")
    assert res.total_eta_seconds > 0.0
    assert len(res.per_segment_eta) == 2
    # 500m at 10m/s is 50s; 300m at 10m/s is 30s -> total 80s
    assert res.total_eta_seconds == pytest.approx(80.0, rel=0.1)


def test_naive_calculator_peak_hour_impedance():
    calc = NaiveETACalculator(default_speed_mps=10.0)
    segs = [SegmentContext(segment_id=999999, distance_meters=1000.0)]
    off_peak = calc.calculate_eta("142", segs, hour_of_day=14, day_type="weekday")
    peak = calc.calculate_eta("142", segs, hour_of_day=9, day_type="weekday")
    # Peak hour should take longer than off-peak
    assert peak.total_eta_seconds > off_peak.total_eta_seconds


def test_ml_calculator_empty_segments():
    calc = LinearRegressionETACalculator()
    res = calc.calculate_eta("142", [], hour_of_day=10, day_type="weekday")
    assert res.total_eta_seconds == 0.0
    assert len(res.per_segment_eta) == 0


def test_ml_calculator_prediction_known_and_unseen():
    calc = LinearRegressionETACalculator()
    segs = [
        SegmentContext(segment_id=1, distance_meters=450.0),
        SegmentContext(segment_id=999999, distance_meters=600.0),
    ]
    res = calc.calculate_eta("142", segs, hour_of_day=10, day_type="weekday")
    assert res.total_eta_seconds > 0.0
    assert len(res.per_segment_eta) == 2
    # Verify each segment is at least 5.0 seconds
    for t in res.per_segment_eta:
        assert t >= 5.0
    assert res.confidence_score > 0.5


def test_ml_calculator_weekend_vs_weekday():
    calc = LinearRegressionETACalculator()
    segs = [SegmentContext(segment_id=1, distance_meters=500.0)]
    wkday = calc.calculate_eta("142", segs, hour_of_day=18, day_type="weekday")
    wknd = calc.calculate_eta("142", segs, hour_of_day=18, day_type="weekend")
    # Both should be positive and non-zero
    assert wkday.total_eta_seconds >= 5.0
    assert wknd.total_eta_seconds >= 5.0
