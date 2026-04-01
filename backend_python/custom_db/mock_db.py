"""
backend_python/db/mock_db.py
=============================
Rich mock data with JSON persistence for user reports and verifications.
"""

import random
from typing import Any
from .persistence import load_all_data, save_data

# ── Deterministic RNG — same seed every boot ──────────────────────────────────
_rng = random.Random(42)

# Load existing data from persistence
_persisted_data = load_all_data()

def _make_zone(zone_id: str, lat: float, lng: float, danger: float) -> dict[str, Any]:
    """Build a synthetic Zone vertex dict."""
    return {
        "zone_id": zone_id,
        "name": zone_id.replace("_", " ").title(),
        "lat": round(lat, 6),
        "lng": round(lng, 6),
        "danger_score": round(danger, 3),
        "historical_danger_score": round(max(0.1, danger - _rng.uniform(-0.1, 0.1)), 3),
        "feature_vectors": [
            [h, 2, round(_rng.uniform(0.5, 4.5), 1), round(_rng.uniform(0.1, 0.9), 2), round(0.9 - (danger * 0.5), 2), round(danger * _rng.uniform(0.2, 0.6), 2)]
            for h in range(24)
        ],
    }

MOCK_ZONES: dict[str, dict] = {
    "zone_mg_brigade": _make_zone("zone_mg_brigade",  12.9716, 77.5946, 0.28),
    "zone_residency":  _make_zone("zone_residency",   12.9698, 77.5981, 0.52),
    "zone_cubbon":     _make_zone("zone_cubbon",      12.9763, 77.5929, 0.71),
    "zone_lavelle":    _make_zone("zone_lavelle",     12.9725, 77.5958, 0.38),
    "zone_stmarks":    _make_zone("zone_stmarks",     12.9738, 77.5965, 0.22),
}

MOCK_INCIDENTS: list[dict] = _persisted_data.get("incidents", [
    {
        "incident_id": "INC_001",
        "incident_type": "poor_lighting",
        "text": "Poorly lit stretch.",
        "severity": 3,
        "verified": True,
        "lat": 12.9698, "lng": 77.5981,
        "timestamp": "2025-01-15T21:30:00Z",
    }
])

# In-memory session state (for /dev endpoints)
IN_MEMORY_REPORTS: list[dict] = []

MOCK_SAFETY_FEATURES = [
    {"feature_id": "SF_001", "feature_type": "streetlight", "lat": 12.9716, "lng": 77.5946, "status": "active"},
    {"feature_id": "SF_002", "feature_type": "cctv", "lat": 12.9698, "lng": 77.5981, "status": "active"},
]

def get_mock_incidents(limit: int = 50) -> list[dict]:
    return MOCK_INCIDENTS[:limit]

def add_mock_incident(incident: dict) -> None:
    MOCK_INCIDENTS.insert(0, incident)
    save_data("incidents", MOCK_INCIDENTS)

def get_all_mock_zones() -> list[dict]:
    return list(MOCK_ZONES.values())

def get_heatmap_data() -> list[dict]:
    return [{"zone_id": z["zone_id"], "lat": z["lat"], "lng": z["lng"], "danger_score": z["danger_score"]} for z in MOCK_ZONES.values()]


def get_mock_zone(zone_id: str) -> dict | None:
    return MOCK_ZONES.get(zone_id)

# Legacy
MOCK_INTERSECTIONS = []
for z in MOCK_ZONES.values():
    MOCK_INTERSECTIONS.append({
        "intersection_id": z["zone_id"], "intersection_name": z["name"],
        "lat": z["lat"], "lng": z["lng"], "baseline_safety_score": 100 - (z["danger_score"] * 100)
    })

def update_incident_verification(incident_id: str, verified: bool):
    global MOCK_INCIDENTS
    for inc in MOCK_INCIDENTS:
        if inc["incident_id"] == incident_id:
            inc["verified"] = verified
            save_data("incidents", MOCK_INCIDENTS)
            return True
    return False
