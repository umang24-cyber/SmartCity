"""
backend_python/custom_db/mock_db.py
=====================================
Chandigarh-centred mock database for Oraya OS demo.
All 30 intersections cover major sectors and key junctions of Chandigarh.
"""

import random
from typing import Any
from .persistence import load_all_data, save_data

_rng = random.Random(42)
_persisted_data = load_all_data()


# ── Chandigarh Intersection Graph ────────────────────────────────────────────
# 30 real junctions across Sectors 1–47 + key landmarks

CHD_INTERSECTIONS = [
    # ID,                    Name,                              lat,      lng,     danger
    ("INT_17A",  "Sector 17 Plaza (Central Business)",        30.7414,  76.7682,  0.18),
    ("INT_22",   "Sector 22 Market Chowk",                   30.7333,  76.7794,  0.32),
    ("INT_35",   "Sector 35 Bus Terminal",                   30.7215,  76.7688,  0.45),
    ("INT_43",   "Sector 43 ISBT Chowk",                    30.7076,  76.7897,  0.55),
    ("INT_9A",   "Sector 9 Rose Garden Gate",                30.7504,  76.7761,  0.22),
    ("INT_11",   "Sector 11 Govt Hospital",                  30.7477,  76.7832,  0.28),
    ("INT_15",   "Sector 15 Leisure Valley",                 30.7411,  76.7776,  0.35),
    ("INT_17B",  "Sector 17 Post Office Chowk",              30.7403,  76.7714,  0.21),
    ("INT_18",   "Sector 18 Market",                         30.7367,  76.7698,  0.40),
    ("INT_20",   "Sector 20 Elante Mall Entry",              30.7341,  76.7921,  0.30),
    ("INT_21",   "Sector 21 Housing Board Chowk",            30.7321,  76.7751,  0.48),
    ("INT_22B",  "Sector 22 D-Park Crossing",                30.7298,  76.7802,  0.38),
    ("INT_26",   "Sector 26 Grain Market",                   30.7276,  76.8012,  0.62),
    ("INT_28",   "Sector 28 Chandigarh Club",                30.7254,  76.7761,  0.25),
    ("INT_32",   "Sector 32 Railway Station Rd",             30.7236,  76.7929,  0.52),
    ("INT_34",   "Sector 34 Light Point",                    30.7218,  76.7802,  0.44),
    ("INT_36",   "Sector 36 Gurudwara Chowk",               30.7201,  76.7688,  0.58),
    ("INT_37",   "Sector 37 Mansa Devi Complex",             30.7178,  76.8101,  0.70),
    ("INT_38",   "Sector 38 Sarangpur Crossing",             30.7161,  76.7921,  0.65),
    ("INT_40",   "Sector 40 Daria Morh",                     30.7134,  76.7802,  0.55),
    ("INT_41",   "Sector 41 ITI Chowk",                      30.7108,  76.7688,  0.60),
    ("INT_44",   "Sector 44 Chandigarh Univ Area",           30.7056,  76.7771,  0.42),
    ("INT_45",   "Sector 45 Dhanas Morh",                    30.7037,  76.7595,  0.68),
    ("INT_46",   "Sector 46 Baltana Crossing",               30.7018,  76.8012,  0.72),
    ("INT_47",   "Sector 47 Nayagaon Entry",                 30.6998,  76.7929,  0.75),
    ("INT_PGI",  "PGI Hospital Main Gate",                   30.7643,  76.7760,  0.15),
    ("INT_TRIB", "Tribune Chowk",                             30.7359,  76.8101,  0.36),
    ("INT_ROCK", "Rock Garden Chowk",                        30.7529,  76.8064,  0.19),
    ("INT_LAKE", "Sukhna Lake Entry",                        30.7422,  76.8193,  0.20),
    ("INT_MHW",  "Madhya Marg / Jan Marg Junction",          30.7389,  76.7854,  0.29),
]

def _make_intersection(int_id, name, lat, lng, danger):
    baseline_safety = round(max(10.0, min(95.0, 100 - danger * 100)), 1)
    return {
        "intersection_id": int_id,
        "zone_id": int_id,
        "intersection_name": name,
        "name": name,
        "lat": lat,
        "lng": lng,
        "danger_score": round(danger, 3),
        "baseline_safety_score": baseline_safety,
        "historical_danger_score": round(max(0.05, danger - _rng.uniform(-0.08, 0.08)), 3),
        "incident_count_24h": _rng.randint(0, 8),
        "lighting_score": round(max(0.2, 1.0 - danger * 0.7 + _rng.uniform(-0.1, 0.1)), 2),
        "visibility_score": round(max(0.2, 0.9 - danger * 0.5 + _rng.uniform(-0.1, 0.1)), 2),
        "isolation_score": round(danger * 0.6 + _rng.uniform(0, 0.2), 3),
        "betweenness_score": round(_rng.uniform(0.1, 0.8), 3),
        "safety_variance": round(_rng.uniform(5, 25), 1),
        "weekend_multiplier": round(_rng.uniform(0.88, 0.98), 3),
        "weather_sensitivity": round(_rng.uniform(0.2, 0.6), 2),
        "peak_danger_hours": [22, 23, 0, 1] if danger > 0.5 else [23, 0],
        "historical_incident_rate": round(danger * 0.6, 3),
        "cluster_id": 1 if lng < 76.80 else 2,
        "last_updated": "2026-04-05T00:00:00Z",
        "feature_vectors": [],
        "recent_data": [],
    }

# Build MOCK_ZONES from Chandigarh intersections
MOCK_ZONES: dict[str, dict] = {}
for _row in CHD_INTERSECTIONS:
    _id, _name, _lat, _lng, _d = _row
    _node = _make_intersection(_id, _name, _lat, _lng, _d)
    MOCK_ZONES[_id] = _node

# For backward compat, also expose as list
MOCK_INTERSECTIONS = list(MOCK_ZONES.values())


# ── Incidents — Chandigarh locations ─────────────────────────────────────────

_default_incidents: list[dict] = [
    {
        "incident_id": "INC_001",
        "incident_type": "poor_lighting",
        "text": "Poorly lit stretch near the Sector 46 crossing late at night.",
        "severity": "high",
        "severity_score": 0.75,
        "credibility": 0.85,
        "emotion": "fear",
        "timestamp": "2026-04-04T21:30:00Z",
        "source": "user_report",
        "location_id": "INT_46",
        "lat": 30.7018, "lng": 76.8012,
        "verified": False,
        "emergency_level": "HIGH",
    },
    {
        "incident_id": "INC_002",
        "incident_type": "felt_followed",
        "text": "Felt followed by a group of men near Sector 47 ISBT area around 11 PM.",
        "severity": "critical",
        "severity_score": 0.92,
        "credibility": 0.90,
        "emotion": "fear",
        "timestamp": "2026-04-04T23:10:00Z",
        "source": "user_report",
        "location_id": "INT_47",
        "lat": 30.6998, "lng": 76.7929,
        "verified": False,
        "emergency_level": "CRITICAL",
    },
    {
        "incident_id": "INC_003",
        "incident_type": "broken_cctv",
        "text": "CCTV camera near Sector 37 Mansa Devi chowk is broken and unresponsive.",
        "severity": "medium",
        "severity_score": 0.48,
        "credibility": 0.70,
        "emotion": "neutral",
        "timestamp": "2026-04-04T19:45:00Z",
        "source": "user_report",
        "location_id": "INT_37",
        "lat": 30.7178, "lng": 76.8101,
        "verified": False,
        "emergency_level": "MEDIUM",
    },
    {
        "incident_id": "INC_004",
        "incident_type": "suspicious_activity",
        "text": "Suspicious group loitering near ATM cluster on Sector 43 ISBT Chowk.",
        "severity": "high",
        "severity_score": 0.78,
        "credibility": 0.82,
        "emotion": "anxiety",
        "timestamp": "2026-04-04T22:00:00Z",
        "source": "user_report",
        "location_id": "INT_43",
        "lat": 30.7076, "lng": 76.7897,
        "verified": False,
        "emergency_level": "HIGH",
    },
    {
        "incident_id": "INC_005",
        "incident_type": "harassment",
        "text": "Street harassment reported near Sector 35 bus terminal evening hours.",
        "severity": "high",
        "severity_score": 0.80,
        "credibility": 0.88,
        "emotion": "fear",
        "timestamp": "2026-04-04T20:15:00Z",
        "source": "user_report",
        "location_id": "INT_35",
        "lat": 30.7215, "lng": 76.7688,
        "verified": False,
        "emergency_level": "HIGH",
    },
    {
        "incident_id": "INC_006",
        "incident_type": "unsafe_road",
        "text": "Road dark and no police patrol visible near Sector 45 Dhanas Morh.",
        "severity": "medium",
        "severity_score": 0.55,
        "credibility": 0.75,
        "emotion": "anxiety",
        "timestamp": "2026-04-04T21:00:00Z",
        "source": "user_report",
        "location_id": "INT_45",
        "lat": 30.7037, "lng": 76.7595,
        "verified": False,
        "emergency_level": "MEDIUM",
    },
]

MOCK_INCIDENTS: list[dict] = _persisted_data.get("incidents", _default_incidents)
IN_MEMORY_REPORTS: list[dict] = []


# ── Safety Features ───────────────────────────────────────────────────────────

MOCK_SAFETY_FEATURES = [
    {"feature_id": "SF_001", "feature_type": "streetlight",     "lat": 30.7414, "lng": 76.7682, "status": "active",   "reliability_score": 0.92, "criticality_score": 0.70, "maintenance_prediction": "14 days"},
    {"feature_id": "SF_002", "feature_type": "cctv",            "lat": 30.7504, "lng": 76.7761, "status": "active",   "reliability_score": 0.88, "criticality_score": 0.85, "maintenance_prediction": "7 days"},
    {"feature_id": "SF_003", "feature_type": "streetlight",     "lat": 30.7076, "lng": 76.7897, "status": "inactive", "reliability_score": 0.40, "criticality_score": 0.80, "maintenance_prediction": "Immediate"},
    {"feature_id": "SF_004", "feature_type": "cctv",            "lat": 30.7178, "lng": 76.8101, "status": "active",   "reliability_score": 0.78, "criticality_score": 0.75, "maintenance_prediction": "30 days"},
    {"feature_id": "SF_005", "feature_type": "emergency_button","lat": 30.7018, "lng": 76.8012, "status": "inactive", "reliability_score": 0.35, "criticality_score": 0.90, "maintenance_prediction": "Immediate"},
    {"feature_id": "SF_006", "feature_type": "cctv",            "lat": 30.7643, "lng": 76.7760, "status": "active",   "reliability_score": 0.95, "criticality_score": 0.60, "maintenance_prediction": "60 days"},
]

MOCK_CAMERAS = [
    {"camera_id": "CAM_001", "location_id": "INT_17A", "lat": 30.7414, "lng": 76.7682, "last_crowd_density": "high",   "last_person_count": 52, "last_danger_contribution": 0.22, "last_analyzed": "2026-04-05T00:00:00Z", "active": True},
    {"camera_id": "CAM_002", "location_id": "INT_43",  "lat": 30.7076, "lng": 76.7897, "last_crowd_density": "medium", "last_person_count": 18, "last_danger_contribution": 0.55, "last_analyzed": "2026-04-04T23:30:00Z", "active": True},
    {"camera_id": "CAM_003", "location_id": "INT_47",  "lat": 30.6998, "lng": 76.7929, "last_crowd_density": "low",    "last_person_count":  4, "last_danger_contribution": 0.72, "last_analyzed": "2026-04-04T22:45:00Z", "active": False},
]


# ── Accessor helpers ──────────────────────────────────────────────────────────

def get_mock_zone(zone_id: str) -> dict | None:
    return MOCK_ZONES.get(zone_id)

def get_all_mock_zones() -> list[dict]:
    return list(MOCK_ZONES.values())

def get_heatmap_data() -> list[dict]:
    return [
        {"zone_id": z["zone_id"], "lat": z["lat"], "lng": z["lng"], "danger_score": z["danger_score"]}
        for z in MOCK_ZONES.values()
    ]

def get_mock_incidents(location_id=None, severity=None, limit=50) -> list[dict]:
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
    MOCK_INCIDENTS.insert(0, incident)
    IN_MEMORY_REPORTS.append(incident)
    save_data("incidents", MOCK_INCIDENTS)

def update_incident_verification(incident_id: str, verified: bool) -> bool:
    global MOCK_INCIDENTS
    for inc in MOCK_INCIDENTS:
        if inc.get("incident_id") == incident_id:
            inc["verified"] = verified
            save_data("incidents", MOCK_INCIDENTS)
            return True
    return False
