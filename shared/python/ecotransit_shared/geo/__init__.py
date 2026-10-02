"""Geospatial calculations and coordinate validation utilities."""

from __future__ import annotations

import math

# Earth's mean radius in meters
EARTH_RADIUS_METERS = 6371000.0


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance between two GPS coordinates in meters."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    return EARTH_RADIUS_METERS * c


def is_in_bounding_box(
    lat: float,
    lon: float,
    min_lat: float,
    max_lat: float,
    min_lon: float,
    max_lon: float,
) -> bool:
    """Returns True if the coordinate lies strictly within the bounding box."""
    return min_lat <= lat <= max_lat and min_lon <= lon <= max_lon


def is_valid_coordinate(lat: float, lon: float) -> bool:
    """Checks coordinate range and rejects obvious artifacts like (0.0, 0.0)."""
    if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
        return False

    # Check for (0, 0) GPS glitch
    return not (abs(lat) < 1e-6 and abs(lon) < 1e-6)
