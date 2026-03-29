"""
TIGERGRAPH ADAPTER
ALL TigerGraph API calls live in this one file.
When Group A shares credentials, fill in .env and flip
DATA_SOURCE=tigergraph. Nothing else changes.
"""
import os
import httpx
from typing import Any, Dict, List, Optional

TG_BASE_URL = os.getenv("TG_BASE_URL", "").rstrip("/").replace(":9000", "")
TG_GRAPH = os.getenv("TG_GRAPH", "SafeRouteGraph")
TG_TOKEN = os.getenv("TG_TOKEN", "")

BASE = f"{TG_BASE_URL}/restpp"

HEADERS = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {TG_TOKEN}",
}


async def _get(path: str, params: Optional[Dict] = None) -> Any:
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.get(f"{BASE}{path}", headers=HEADERS, params=params)
        res.raise_for_status()
        return res.json()


async def _post(path: str, body: Dict) -> Any:
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.post(f"{BASE}{path}", headers=HEADERS, json=body)
        res.raise_for_status()
        return res.json()


# ── GET single Intersection vertex ───────────────────────────────
async def get_intersection(intersection_id: str) -> Dict:
    data = await _get(f"/graph/{TG_GRAPH}/vertices/Intersection/{intersection_id}")
    return data["results"][0]["attributes"]


# ── GET all Intersections ─────────────────────────────────────────
async def get_all_intersections() -> List[Dict]:
    data = await _get(f"/graph/{TG_GRAPH}/vertices/Intersection")
    return [item["attributes"] | {"intersection_id": item["v_id"]} for item in data["results"]]


# ── GET SafetyFeatures connected to an Intersection ───────────────
async def get_features_for_intersection(intersection_id: str) -> List[Dict]:
    data = await _get(f"/graph/{TG_GRAPH}/edges/Intersection/{intersection_id}/HAS_FEATURE")
    return [item["attributes"] for item in data["results"]]


# ── GET current TimeSlice vertex ──────────────────────────────────
async def get_current_time_slice() -> Dict:
    from datetime import datetime
    now = datetime.now()
    ts_id = f"{now.date().isoformat()}-{str(now.hour).zfill(2)}"
    data = await _get(f"/graph/{TG_GRAPH}/vertices/TimeSlice/{ts_id}")
    return data["results"][0]["attributes"]


# ── GET SafeRoute via GSQL installed query ────────────────────────
async def get_safe_route(start_id: str, end_id: str) -> Dict:
    data = await _get(f"/query/{TG_GRAPH}/getSafeRoute", params={"start": start_id, "end": end_id})
    return data["results"][0]


# ── GET Cluster by ID ─────────────────────────────────────────────
async def get_cluster(cluster_id: int) -> Dict:
    data = await _get(f"/graph/{TG_GRAPH}/vertices/SafetyCluster/{cluster_id}")
    return data["results"][0]["attributes"]


# ── GET all Incidents ─────────────────────────────────────────────
async def get_all_incidents(verified_only: bool = False) -> List[Dict]:
    data = await _get(f"/graph/{TG_GRAPH}/vertices/IncidentReport")
    incidents = []
    for item in data["results"]:
        attrs = item["attributes"]
        if verified_only and not attrs.get("verified"):
            continue
        incidents.append({
            "incident_id": item["v_id"],
            "incident_type": attrs.get("incident_type"),
            "severity": attrs.get("severity"),
            "reported_at": attrs.get("reported_at"),
            "verified": attrs.get("verified"),
            "source": attrs.get("source"),
            "lat": attrs.get("lat"),
            "lng": attrs.get("lng"),
        })
    return incidents


# ── POST new IncidentReport vertex ────────────────────────────────
async def create_incident(incident: Dict) -> Dict:
    body = {
        "vertices": {
            "IncidentReport": {
                incident["incident_id"]: {
                    "incident_type": {"value": incident["incident_type"]},
                    "severity": {"value": incident["severity"]},
                    "reported_at": {"value": incident["reported_at"]},
                    "verified": {"value": False},
                    "source": {"value": incident["source"]},
                    "lat": {"value": incident["lat"]},
                    "lng": {"value": incident["lng"]},
                }
            }
        }
    }
    return await _post(f"/graph/{TG_GRAPH}", body)
