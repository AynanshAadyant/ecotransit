"""Integration tests for FastAPI ETA Serving Server."""

import sys
from pathlib import Path

from starlette.testclient import TestClient

service_dir = Path(__file__).resolve().parents[1]
if str(service_dir) not in sys.path:
    sys.path.insert(0, str(service_dir))

from server import app  # noqa: E402

client = TestClient(app)


def test_root_endpoint():
    resp = client.get("/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["service"] == "ecotransit_intelligence_microservice"
    assert data["status"] == "online"


def test_health_endpoint():
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] in ("healthy", "degraded")
    assert "timestamp_ist" in data


def test_predict_eta_with_explicit_segments():
    payload = {
        "bus_id": "DL1PC1234",
        "route_id": "142",
        "target_stop_id": "10450",
        "remaining_segments": [
            {"segment_id": 1, "distance_meters": 300.0, "sequence": 0},
            {"segment_id": 2, "distance_meters": 400.0, "sequence": 1},
        ],
        "hour_of_day": 10,
        "day_type": "weekday",
    }
    resp = client.post("/api/v1/predict-eta", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["bus_id"] == "DL1PC1234"
    assert data["route_id"] == "142"
    assert data["total_distance_meters"] == 700.0
    assert data["naive_eta_seconds"] > 0
    assert data["ml_eta_seconds"] > 0
    assert len(data["segments"]) == 2
    assert "computed_at_ist" in data


def test_predict_eta_empty_segments_fallback():
    payload = {
        "route_id": "142",
        "target_stop_id": "10450",
        "remaining_segments": [],
    }
    resp = client.post("/api/v1/predict-eta", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["preferred_eta_seconds"] > 0
    assert len(data["segments"]) > 0


def test_get_model_metadata():
    resp = client.get("/api/v1/models/metadata")
    assert resp.status_code == 200
    data = resp.json()
    assert "parameters" in data
    assert "metrics" in data


def test_list_segments():
    resp = client.get("/api/v1/segments?limit=5")
    assert resp.status_code == 200
    data = resp.json()
    assert "segments" in data
    assert len(data["segments"]) <= 5
