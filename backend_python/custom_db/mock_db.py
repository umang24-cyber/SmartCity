"""
backend_python/custom_db/mock_db.py
=====================================
Merged mock database combining:
- devB's persistence layer, RBAC data (MOCK_SAFETY_FEATURES, MOCK_INTERSECTIONS,
  update_incident_verification, save/load)
- ai's richer zone data (15 synthetic zones, MOCK_CAMERAS, richer incident fields)

Rich mock data that mirrors the TigerGraph vertex schemas defined in
SMART_CITY_INTEGRATION_PLAN.md §5.1.

The mock data is *deterministically seeded* so every server restart
returns the same zone scores — crucial for reproducible demos.

When USE_MOCK_DB=false and a real TigerGraph instance is reachable,
none of these functions are called; the DB layer hits the live graph.
"""

import random
from typing import Any
from .persistence import load_all_data, save_data

# ── Deterministic RNG — same seed every boot ──────────────────────────────────
_rng = random.Random(42)

# Load existing persisted data (users-submitted reports, verified incidents)
_persisted_data = load_all_data()


# ── Zone vertices ─────────────────────────────────────────────────────────────
# Covers the existing 5 Bangalore intersections + 15 synthetic urban zones

def _make_zone(zone_id: str, lat: float, lng: float, danger: float) -> dict[str, Any]:
    """Build a synthetic Zone vertex dict."""
    return {
        "zone_id": zone_id,
        "name": zone_id.replace("_", " ").title(),
        "lat": round(lat, 6),
        "lng": round(lng, 6),
        "danger_score": round(danger, 3),
        "historical_danger_score": round(max(0.1, danger - _rng.uniform(-0.1, 0.1)), 3),
        "incident_count_24h": _rng.randint(0, 12),
        "last_updated": "2025-01-15T20:00:00Z",
        # Feature vectors: 24 h × 6 features
        # [hour, day_of_week, crime_count, crowd_density, lighting_score, report_density]
        "feature_vectors": [
            [
                h,
                2,                              # Wednesday baseline
                round(_rng.uniform(0.5, 4.5), 1),
                round(_rng.uniform(0.1, 0.9), 2),
                round(0.9 - (danger * 0.5), 2),  # worse lighting in high-danger zones
                round(danger * _rng.uniform(0.2, 0.6), 2),
            ]
            for h in range(24)
        ],
        # Recent data for anomaly detection
        "recent_data": [
            {
                "hour": h,
                "incident_count": _rng.randint(0, 5),
                "crowd": round(_rng.uniform(0.1, 0.9), 2),
            }
            for h in range(24)
        ],
    }


# Anchor zones around the real Bangalore intersections
MOCK_ZONES: dict[str, dict] = {
    "zone_mg_brigade": _make_zone("zone_mg_brigade",  12.9716, 77.5946, 0.28),
    "zone_residency":  _make_zone("zone_residency",   12.9698, 77.5981, 0.52),
    "zone_cubbon":     _make_zone("zone_cubbon",      12.9763, 77.5929, 0.71),
    "zone_lavelle":    _make_zone("zone_lavelle",     12.9725, 77.5958, 0.38),
    "zone_stmarks":    _make_zone("zone_stmarks",     12.9738, 77.5965, 0.22),
}

# Add 15 synthetic zones spread around the city
_base_lat, _base_lng = 12.970, 77.590
for _i in range(15):
    _zid = f"zone_{_i + 1}"
    _danger = round(_rng.uniform(0.15, 0.85), 3)
    MOCK_ZONES[_zid] = _make_zone(
        _zid,
        _base_lat + (_i % 5) * 0.012,
        _base_lng + (_i // 5) * 0.015,
        _danger,
    )


# ── Incident vertices ─────────────────────────────────────────────────────────
# Load from persistence if available, else use seeded defaults

_default_incidents: list[dict] = [
    {
        "incident_id": "INC_001",
        "incident_type": "poor_lighting",
        "text": "Poorly lit stretch near the bus stop at night.",
        "severity": "high",
        "severity_score": 0.75,
        "credibility": 0.85,
        "emotion": "fear",
        "timestamp": "2025-01-15T21:30:00Z",
        "source": "user_report",
        "location_id": "zone_residency",
        "lat": 12.9698,
        "lng": 77.5981,
        "verified": True,
    },
    {
        "incident_id": "INC_002",
        "incident_type": "felt_followed",
        "text": "Felt followed by a group of men near Cubbon Park after 11 PM.",
        "severity": "critical",
        "severity_score": 0.92,
        "credibility": 0.90,
        "emotion": "fear",
        "timestamp": "2025-01-15T23:10:00Z",
        "source": "user_report",
        "location_id": "zone_cubbon",
        "lat": 12.9763,
        "lng": 77.5929,
        "verified": True,
    },
    {
        "incident_id": "INC_003",
        "incident_type": "broken_cctv",
        "text": "CCTV camera on Brigade Road appears to be broken.",
        "severity": "medium",
        "severity_score": 0.48,
        "credibility": 0.70,
        "emotion": "neutral",
        "timestamp": "2025-01-14T19:45:00Z",
        "source": "user_report",
        "location_id": "zone_mg_brigade",
        "lat": 12.9720,
        "lng": 77.5950,
        "verified": False,
    },
    {
        "incident_id": "INC_004",
        "incident_type": "suspicious_activity",
        "text": "Suspicious activity near ATM cluster on MG Road late at night.",
        "severity": "high",
        "severity_score": 0.78,
        "credibility": 0.82,
        "emotion": "anxiety",
        "timestamp": "2025-01-15T22:00:00Z",
        "source": "user_report",
        "location_id": "zone_mg_brigade",
        "lat": 12.9745,
        "lng": 77.5960,
        "verified": True,
    },
]

MOCK_INCIDENTS: list[dict] = _persisted_data.get("incidents", _default_incidents)

# In-memory session store for newly submitted reports (cleared on restart)
IN_MEMORY_REPORTS: list[dict] = []


# ── Camera vertices ───────────────────────────────────────────────────────────

MOCK_CAMERAS: list[dict] = [
    {
        "camera_id": "CAM_001",
        "location_id": "zone_mg_brigade",
        "lat": 12.9716,
        "lng": 77.5946,
        "last_crowd_density": "medium",
        "last_person_count": 24,
        "last_danger_contribution": 0.35,
        "last_analyzed": "2025-01-15T20:00:00Z",
        "active": True,
    },
    {
        "camera_id": "CAM_002",
        "location_id": "zone_cubbon",
        "lat": 12.9763,
        "lng": 77.5929,
        "last_crowd_density": "low",
        "last_person_count": 4,
        "last_danger_contribution": 0.62,
        "last_analyzed": "2025-01-15T22:30:00Z",
        "active": True,
    },
]


# ── Safety Features (for supervisor dashboard) ────────────────────────────────

MOCK_SAFETY_FEATURES = [
    {"feature_id": "SF_001", "feature_type": "streetlight", "lat": 12.9716, "lng": 77.5946, "status": "active"},
    {"feature_id": "SF_002", "feature_type": "cctv",        "lat": 12.9698, "lng": 77.5981, "status": "active"},
    {"feature_id": "SF_003", "feature_type": "streetlight", "lat": 12.9763, "lng": 77.5929, "status": "inactive"},
    {"feature_id": "SF_004", "feature_type": "cctv",        "lat": 12.9725, "lng": 77.5958, "status": "active"},
    {"feature_id": "SF_005", "feature_type": "emergency_button", "lat": 12.9738, "lng": 77.5965, "status": "inactive"},
]


# ── Legacy MOCK_INTERSECTIONS (derived from zones for backward compat) ─────────

MOCK_INTERSECTIONS = []
for _z in MOCK_ZONES.values():
    MOCK_INTERSECTIONS.append({
        "intersection_id": _z["zone_id"],
        "intersection_name": _z["name"],
        "lat": _z["lat"],
        "lng": _z["lng"],
        "baseline_safety_score": round(100 - (_z["danger_score"] * 100), 1),
    })


# ── Accessor helpers ──────────────────────────────────────────────────────────

def get_mock_zone(zone_id: str) -> dict | None:
    """Returns the Zone dict for *zone_id*, or None if not found."""
    return MOCK_ZONES.get(zone_id)


def get_all_mock_zones() -> list[dict]:
    """Returns all Zone dicts as a list."""
    return list(MOCK_ZONES.values())


def get_heatmap_data() -> list[dict]:
    """Returns a compacted list of zone data for the map heatmap layer."""
    return [
        {
            "zone_id": z["zone_id"],
            "lat": z["lat"],
            "lng": z["lng"],
            "danger_score": z["danger_score"],
        }
        for z in MOCK_ZONES.values()
    ]


def get_mock_incidents(
    location_id: str | None = None,
    severity: str | None = None,
    limit: int = 50,
) -> list[dict]:
    """
    Returns incident dicts from the mock store, optionally filtered.

    Combines seeded incidents with any in-session reports submitted via
    the /report endpoint.
    """
    all_incidents = MOCK_INCIDENTS + IN_MEMORY_REPORTS
    result = []
    for inc in all_incidents:
        if location_id and inc.get("location_id") != location_id:
            continue
        if severity and str(inc.get("severity", "")).lower() != severity.lower():
            continue
        result.append(inc)
        if len(result) >= limit:
            break
    return result


def add_mock_incident(incident: dict) -> None:
    """Appends a new incident to both the in-memory session store and persistence."""
    MOCK_INCIDENTS.insert(0, incident)
    IN_MEMORY_REPORTS.append(incident)
    save_data("incidents", MOCK_INCIDENTS)


def update_incident_verification(incident_id: str, verified: bool) -> bool:
    """Mark an incident as verified/unverified; persists the change."""
    global MOCK_INCIDENTS
    for inc in MOCK_INCIDENTS:
        if inc.get("incident_id") == incident_id:
            inc["verified"] = verified
            save_data("incidents", MOCK_INCIDENTS)
            return True
    return False
