"""
backend_python/utils/geo_utils.py
===================================
Geospatial helpers — coordinate validation, bounding boxes,
Haversine distance, and zone-ID generation.

All functions are pure (no I/O, no side-effects) and safe to
use in concurrent async handlers.
"""

import math
from typing import Optional


# ── Constants ─────────────────────────────────────────────────────────────────

EARTH_RADIUS_M = 6_371_000.0   # metres


# ── Zone / Location ID helpers ────────────────────────────────────────────────

def coords_to_zone_id(lat: float, lng: float, precision: int = 4) -> str:
    """
    Generates a deterministic string zone-ID from a decimal coordinate pair.

    The ID format is ``<lat>_<lng>`` rounded to *precision* decimal places,
    which tiles the map into cells of roughly:
      - 4 dp → ~11 m resolution
      - 3 dp → ~111 m resolution
      - 2 dp → ~1.1 km resolution

    >>> coords_to_zone_id(30.7333, 76.7794, 4)
    '30.7333_76.7794'
    """
    return f"{round(lat, precision)}_{round(lng, precision)}"


def zone_id_to_coords(zone_id: str) -> tuple[float, float]:
    """
    Parses a zone-ID produced by :func:`coords_to_zone_id` back to (lat, lng).

    Raises ValueError on malformed input.

    >>> zone_id_to_coords('30.7333_76.7794')
    (30.7333, 76.7794)
    """
    parts = zone_id.split("_")
    if len(parts) != 2:
        raise ValueError(f"Invalid zone_id format: '{zone_id}' — expected 'lat_lng'")
    try:
        return float(parts[0]), float(parts[1])
    except ValueError as exc:
        raise ValueError(f"Cannot parse zone_id '{zone_id}': {exc}") from exc


# ── Coordinate validation ─────────────────────────────────────────────────────

def is_valid_lat(lat: float) -> bool:
    """Returns True if *lat* is in [-90, 90]."""
    return -90.0 <= lat <= 90.0


def is_valid_lng(lng: float) -> bool:
    """Returns True if *lng* is in [-180, 180]."""
    return -180.0 <= lng <= 180.0


def validate_coords(lat: float, lng: float) -> None:
    """
    Raises ValueError if *lat* or *lng* are out of range.

    Use this at API entry points to fail fast before expensive inference.
    """
    if not is_valid_lat(lat):
        raise ValueError(f"Latitude {lat} is out of valid range [-90, 90]")
    if not is_valid_lng(lng):
        raise ValueError(f"Longitude {lng} is out of valid range [-180, 180]")


# ── Distance calculation ──────────────────────────────────────────────────────

def haversine_distance(
    lat1: float, lng1: float,
    lat2: float, lng2: float,
) -> float:
    """
    Returns the great-circle distance in **metres** between two coordinates
    using the Haversine formula.

    Args:
        lat1, lng1: First point (decimal degrees)
        lat2, lng2: Second point (decimal degrees)

    Returns:
        Distance in metres (float)

    >>> abs(haversine_distance(0, 0, 0, 1) - 111_195) < 10
    True
    """
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lam = math.radians(lng2 - lng1)

    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


# ── Bounding box helpers ──────────────────────────────────────────────────────

def bounding_box(
    lat: float, lng: float, radius_m: float
) -> tuple[float, float, float, float]:
    """
    Returns an approximate bounding box (min_lat, min_lng, max_lat, max_lng)
    for a circle of *radius_m* metres centred at (*lat*, *lng*).

    The approximation is accurate to within ~0.5 % for radii < 100 km.

    Returns:
        (min_lat, min_lng, max_lat, max_lng) — all in decimal degrees
    """
    lat_delta = math.degrees(radius_m / EARTH_RADIUS_M)
    lng_delta = math.degrees(radius_m / (EARTH_RADIUS_M * math.cos(math.radians(lat))))
    return (
        lat - lat_delta,
        lng - lng_delta,
        lat + lat_delta,
        lng + lng_delta,
    )


def point_in_bbox(
    lat: float, lng: float,
    min_lat: float, min_lng: float,
    max_lat: float, max_lng: float,
) -> bool:
    """Returns True if (*lat*, *lng*) lies within the given bounding box."""
    return min_lat <= lat <= max_lat and min_lng <= lng <= max_lng


# ── GeoJSON helpers ───────────────────────────────────────────────────────────

def coords_to_geojson_point(lat: float, lng: float) -> dict:
    """Returns a GeoJSON Point geometry dict for *lat*, *lng*."""
    return {
        "type": "Point",
        "coordinates": [lng, lat],   # GeoJSON is [lng, lat]
    }


def coords_list_to_geojson_linestring(coord_pairs: list[list[float]]) -> dict:
    """
    Converts a list of [lat, lng] pairs to a GeoJSON LineString.

    Note: GeoJSON coordinates are [lng, lat], so the order is swapped.
    Input format is the internal [lat, lng] convention used everywhere
    else in this codebase.
    """
    return {
        "type": "LineString",
        "coordinates": [[lng, lat] for lat, lng in coord_pairs],
    }


def find_nearest(
    lat: float,
    lng: float,
    candidates: list[dict],
    lat_key: str = "lat",
    lng_key: str = "lng",
    max_radius_m: Optional[float] = None,
) -> Optional[dict]:
    """
    Finds the candidate dict closest to (*lat*, *lng*) by Haversine distance.

    Args:
        candidates:   List of dicts each containing latitude / longitude fields.
        lat_key:      Key name for latitude in each candidate dict.
        lng_key:      Key name for longitude in each candidate dict.
        max_radius_m: If set, returns None when the nearest candidate is
                      farther than this distance (metres).

    Returns:
        The nearest candidate dict, or None if *candidates* is empty
        or all candidates exceed *max_radius_m*.
    """
    if not candidates:
        return None

    nearest: Optional[dict] = None
    min_dist = float("inf")

    for candidate in candidates:
        c_lat = candidate.get(lat_key)
        c_lng = candidate.get(lng_key)
        if c_lat is None or c_lng is None:
            continue
        dist = haversine_distance(lat, lng, float(c_lat), float(c_lng))
        if dist < min_dist:
            min_dist = dist
            nearest = candidate

    if max_radius_m is not None and min_dist > max_radius_m:
        return None

    return nearest
