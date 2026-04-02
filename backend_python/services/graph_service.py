from typing import List, Dict, Any

from custom_db.tigergraph_client import get_all_zones, get_zone_data


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _normalize_zone(zone: Dict[str, Any]) -> Dict[str, Any]:
    zone_id = zone.get("zone_id") or zone.get("v_id") or zone.get("id")
    lat = zone.get("lat", zone.get("latitude", zone.get("center_lat")))
    lng = zone.get("lng", zone.get("lon", zone.get("longitude", zone.get("center_lng"))))
    danger = zone.get("danger_score", zone.get("risk_score", zone.get("score", 0.0)))
    return {
        **zone,
        "zone_id": str(zone_id) if zone_id is not None else "",
        "lat": _to_float(lat),
        "lng": _to_float(lng),
        "danger_score": _to_float(danger),
    }


async def get_heatmap_data() -> List[Dict[str, Any]]:
    zones = await get_all_zones(limit=10000)
    return [_normalize_zone(zone) for zone in zones]


async def get_zone_summary_data(zone_id: str) -> Dict[str, Any]:
    zone = await get_zone_data(zone_id)
    return _normalize_zone(zone)
