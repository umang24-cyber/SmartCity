"""
TIGERGRAPH ADAPTER
ALL TigerGraph API calls live in this one file.
"""
import socket
import httpx
from typing import Any, Dict, List, Optional
import logging

from config import TIGERGRAPH_HOST, TIGERGRAPH_GRAPH, TIGERGRAPH_TOKEN

logger = logging.getLogger(__name__)

# ── DNS bypass for restricted networks (college Wi-Fi) ─────────────────────────
# Pre-resolved IPs for the TigerGraph Cloud instance.
_TG_HOSTNAME = (
    TIGERGRAPH_HOST
    .replace("https://", "")
    .replace("http://", "")
    .split("/")[0]
)
_TG_IPS = ["3.109.145.130", "13.126.119.236", "13.126.226.150"]

_orig_getaddrinfo = socket.getaddrinfo


def _patched_getaddrinfo(host, port, *args, **kwargs):
    if host == _TG_HOSTNAME:
        # rotate through available IPs
        ip = _TG_IPS[0]
        logger.debug("DNS patch: %s → %s", host, ip)
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, '', (ip, port or 443))]
    return _orig_getaddrinfo(host, port, *args, **kwargs)


socket.getaddrinfo = _patched_getaddrinfo
# ──────────────────────────────────────────────────────────────────────────────

# Construct the REST++ base URL from the managed cloud host 
# (Managed TG instances use /restpp as the endpoint prefix)
BASE = f"{TIGERGRAPH_HOST}/restpp"

HEADERS = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {TIGERGRAPH_TOKEN}",
}


async def _get(path: str, params: Optional[Dict] = None) -> Any:
    logger.info("TigerGraph GET %s params=%s", path, params)
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.get(f"{BASE}{path}", headers=HEADERS, params=params)
        res.raise_for_status()
        logger.info("TigerGraph GET %s -> %s", path, res.status_code)
        return res.json()


async def _post(path: str, body: Dict) -> Any:
    logger.info("TigerGraph POST %s", path)
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.post(f"{BASE}{path}", headers=HEADERS, json=body)
        res.raise_for_status()
        logger.info("TigerGraph POST %s -> %s", path, res.status_code)
        return res.json()


# ── GET single Intersection vertex ───────────────────────────────
async def get_intersection(intersection_id: str) -> Dict:
    data = await _get(f"/graph/{TIGERGRAPH_GRAPH}/vertices/Intersection/{intersection_id}")
    results = data.get("results", [])
    if not results:
        raise RuntimeError(f"TigerGraph connection failed: intersection '{intersection_id}' not found")
    return results[0]["attributes"]


# ── GET all Intersections ─────────────────────────────────────────
async def get_all_intersections() -> List[Dict]:
    data = await _get(f"/graph/{TIGERGRAPH_GRAPH}/vertices/Intersection")
    return [item["attributes"] | {"intersection_id": item["v_id"]} for item in data.get("results", [])]


# ── GET SafetyFeatures connected to an Intersection ───────────────
async def get_features_for_intersection(intersection_id: str) -> List[Dict]:
    data = await _get(f"/graph/{TIGERGRAPH_GRAPH}/edges/Intersection/{intersection_id}")
    if data.get("error") is True:
        return []
    return [item.get("attributes", {}) for item in data.get("results", [])]


# ── GET current TimeSlice vertex ──────────────────────────────────
async def get_current_time_slice() -> Dict:
    from datetime import datetime
    now = datetime.now()
    ts_id = f"{now.date().isoformat()}-{str(now.hour).zfill(2)}"
    data = await _get(f"/graph/{TIGERGRAPH_GRAPH}/vertices/TimeSlice/{ts_id}")
    results = data.get("results", [])
    if results:
        return results[0]["attributes"]
    fallback = await _get(f"/graph/{TIGERGRAPH_GRAPH}/vertices/TimeSlice")
    fallback_results = fallback.get("results", [])
    if fallback_results:
        return fallback_results[0]["attributes"]
    raise RuntimeError("TigerGraph connection failed: no TimeSlice vertices returned")


# ── GET SafeRoute via GSQL installed query ────────────────────────
async def get_safe_route(start_id: str, end_id: str) -> Dict:
    data = await _get(f"/query/{TIGERGRAPH_GRAPH}/getSafeRoute", params={"start": start_id, "end": end_id})
    return data["results"][0]


# ── GET Cluster by ID ─────────────────────────────────────────────
async def get_cluster(cluster_id: int) -> Dict:
    data = await _get(f"/graph/{TIGERGRAPH_GRAPH}/vertices/SafetyCluster/{cluster_id}")
    return data["results"][0]["attributes"]


# ── GET all Incidents ─────────────────────────────────────────────
async def get_all_incidents(verified_only: bool = False) -> List[Dict]:
    # Vertex type in loaded schema is 'Incident' (not 'IncidentReport')
    data = await _get(f"/graph/{TIGERGRAPH_GRAPH}/vertices/Incident")
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
    return await _post(f"/graph/{TIGERGRAPH_GRAPH}", body)
