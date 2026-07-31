"""Safe Route Service - graph-based routing over Chandigarh intersections."""

from __future__ import annotations

import heapq
import json
import logging
import math
from collections import defaultdict
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Tuple

logger = logging.getLogger(__name__)

DANGER_LEVELS = {
    "safe": (0.0, 0.25),
    "moderate": (0.25, 0.50),
    "unsafe": (0.50, 0.75),
    "critical": (0.75, 1.0),
}
DANGER_COLORS = {
    "safe": "#22c55e",
    "moderate": "#f59e0b",
    "unsafe": "#f97316",
    "critical": "#ef4444",
}

_DATA_DIR = Path(__file__).resolve().parents[2] / "data"
_VERTICES_PATH = _DATA_DIR / "chandigarh_vertices.json"
_EDGES_PATH = _DATA_DIR / "chandigarh_edges.json"


def _score_to_level(score: float) -> str:
    for level, (lo, hi) in DANGER_LEVELS.items():
        if lo <= score < hi:
            return level
    return "critical"


def _route_recommendation(level: str) -> str:
    recommendations = {
        "safe": "Route is safe. Proceed normally.",
        "moderate": "Route has some moderate risk areas. Stay alert and use well-lit paths.",
        "unsafe": "Route passes through unsafe areas. Consider an alternative or travel with company.",
        "critical": "Route is highly dangerous. Strongly recommend avoiding. Call emergency services if needed.",
    }
    return recommendations.get(level, recommendations["moderate"])


def _haversine_distance(p1: Tuple[float, float], p2: Tuple[float, float]) -> float:
    R = 6_371_000
    lat1, lon1 = math.radians(p1[0]), math.radians(p1[1])
    lat2, lon2 = math.radians(p2[0]), math.radians(p2[1])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


@lru_cache(maxsize=1)
def _load_vertices() -> Dict[str, Dict[str, Any]]:
    with _VERTICES_PATH.open("r", encoding="utf-8") as f:
        payload = json.load(f)

    intersections = payload["vertices"]["Intersection"]
    nodes: Dict[str, Dict[str, Any]] = {}
    for node_id, vertex in intersections.items():
        nodes[node_id] = {
            "lat": vertex["latitude"]["value"],
            "lng": vertex["longitude"]["value"],
            "baseline_safety_score": vertex.get("baseline_safety_score", {}).get("value", 0.65),
        }
    return nodes


@lru_cache(maxsize=1)
def _load_graph() -> tuple[Dict[str, Dict[str, Any]], Dict[str, list[tuple[str, float]]], Dict[tuple[str, str], Dict[str, float]]]:
    nodes = _load_vertices()
    with _EDGES_PATH.open("r", encoding="utf-8") as f:
        payload = json.load(f)

    graph: Dict[str, list[tuple[str, float]]] = defaultdict(list)
    edge_meta: Dict[tuple[str, str], Dict[str, float]] = {}

    for edge in payload["edges"]:
        if edge.get("edge_type") != "connects_to":
            continue

        u = edge["from_id"]
        v = edge["to_id"]
        attrs = edge.get("attributes", {})
        distance = float(attrs["distance"]["value"])
        risk = float(attrs["risk_score"]["value"])
        weight = distance + risk

        graph[u].append((v, weight))
        graph[v].append((u, weight))
        edge_meta[(u, v)] = {"distance": distance, "risk_score": risk}
        edge_meta[(v, u)] = {"distance": distance, "risk_score": risk}

    return nodes, graph, edge_meta


def _nearest_node(point: Tuple[float, float], nodes: Dict[str, Dict[str, Any]]) -> str:
    return min(nodes, key=lambda node_id: _haversine_distance(point, (nodes[node_id]["lat"], nodes[node_id]["lng"])))


def _dijkstra(
    graph: Dict[str, list[tuple[str, float]]],
    start_node: str,
    end_node: str,
) -> list[str]:
    dist: Dict[str, float] = {start_node: 0.0}
    parent: Dict[str, str] = {}
    heap: list[tuple[float, str]] = [(0.0, start_node)]

    while heap:
        current_cost, node = heapq.heappop(heap)
        if node == end_node:
            break
        if current_cost > dist.get(node, float("inf")):
            continue

        for neighbor, weight in graph.get(node, []):
            candidate = current_cost + weight
            if candidate < dist.get(neighbor, float("inf")):
                dist[neighbor] = candidate
                parent[neighbor] = node
                heapq.heappush(heap, (candidate, neighbor))

    if end_node not in dist:
        return [start_node, end_node]

    path = [end_node]
    while path[-1] != start_node:
        prev = parent.get(path[-1])
        if prev is None:
            return [start_node, end_node]
        path.append(prev)
    path.reverse()
    return path


def _path_edge_data(
    path: list[str],
    edge_meta: Dict[tuple[str, str], Dict[str, float]],
) -> list[Dict[str, float]]:
    edges: list[Dict[str, float]] = []
    for i in range(len(path) - 1):
        meta = edge_meta.get((path[i], path[i + 1]))
        if meta is None:
            continue
        edges.append(meta)
    return edges


def _build_route_payload(
    path: list[str],
    nodes: Dict[str, Dict[str, Any]],
    edge_meta: Dict[tuple[str, str], Dict[str, float]],
    start_point: Tuple[float, float],
    end_point: Tuple[float, float],
    mode: str,
) -> Dict[str, Any]:
    node_coordinates = [[nodes[node]["lng"], nodes[node]["lat"]] for node in path if node in nodes]
    if len(node_coordinates) == 1:
        node_coordinates = [node_coordinates[0], node_coordinates[0]]
    if len(node_coordinates) < 2:
        raise ValueError("Route path must contain at least two intersections")

    edges = _path_edge_data(path, edge_meta)
    total_distance_km = sum(edge["distance"] for edge in edges)
    total_distance_m = round(total_distance_km * 1000, 1)
    risk_scores = [edge["risk_score"] for edge in edges]
    avg_risk = round(sum(risk_scores) / len(risk_scores), 3) if risk_scores else 0.35
    overall_level = _score_to_level(avg_risk)
    estimated_time_minutes = round(total_distance_m / (83.33 if mode == "walking" else 500.0), 1)

    segments = []
    for i in range(len(path) - 1):
        edge = edge_meta.get((path[i], path[i + 1]))
        if edge is None:
            continue
        segment_level = _score_to_level(edge["risk_score"])
        segments.append({
            "segment_id": i,
            "start": {"node_id": path[i], "lat": nodes[path[i]]["lat"], "lng": nodes[path[i]]["lng"]},
            "end": {"node_id": path[i + 1], "lat": nodes[path[i + 1]]["lat"], "lng": nodes[path[i + 1]]["lng"]},
            "distance_km": round(edge["distance"], 3),
            "risk_score": round(edge["risk_score"], 3),
            "danger_level": segment_level,
            "color": DANGER_COLORS[segment_level],
            "geojson_feature": {
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [nodes[path[i]]["lng"], nodes[path[i]]["lat"]],
                        [nodes[path[i + 1]]["lng"], nodes[path[i + 1]]["lat"]],
                    ],
                },
                "properties": {
                    "segment_id": i,
                    "distance_km": round(edge["distance"], 3),
                    "risk_score": round(edge["risk_score"], 3),
                    "danger_level": segment_level,
                    "color": DANGER_COLORS[segment_level],
                },
            },
        })

    route_geojson = {
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": node_coordinates,
        },
        "properties": {
            "overall_danger_score": avg_risk,
            "danger_level": overall_level,
            "distance_m": total_distance_m,
            "estimated_time_minutes": estimated_time_minutes,
            "mode": mode,
        },
    }

    safe_waypoints = [
        {
            "node_id": node_id,
            "lat": nodes[node_id]["lat"],
            "lng": nodes[node_id]["lng"],
            "score": round(1.0 - nodes[node_id].get("baseline_safety_score", 0.65), 3),
        }
        for node_id in path
        if node_id in nodes
    ]

    return {
        "route": route_geojson,
        "segments": {"type": "FeatureCollection", "features": [seg["geojson_feature"] for seg in segments]},
        "waypoints": safe_waypoints,
        "stats": {
            "overall_danger_score": avg_risk,
            "danger_level": overall_level,
            "safety_score": round(1.0 - avg_risk, 3),
            "distance_m": total_distance_m,
            "estimated_time_minutes": estimated_time_minutes,
            "recommendation": _route_recommendation(overall_level),
            "mode": mode,
        },
        "start": {"lat": start_point[0], "lng": start_point[1]},
        "end": {"lat": end_point[0], "lng": end_point[1]},
    }


async def compute_safe_route(
    start_lat: float,
    start_lng: float,
    end_lat: float,
    end_lng: float,
    models: dict,
    mode: str = "walking",
) -> Dict[str, Any]:
    """Compute a safe route using Dijkstra over Chandigarh intersections."""
    del models

    nodes, graph, edge_meta = _load_graph()
    start = (start_lat, start_lng)
    end = (end_lat, end_lng)

    if not nodes:
        raise RuntimeError("No intersections available for routing")

    start_node = _nearest_node(start, nodes)
    end_node = _nearest_node(end, nodes)
    path = _dijkstra(graph, start_node, end_node)

    try:
        return _build_route_payload(path, nodes, edge_meta, start, end, mode)
    except Exception as exc:
        logger.warning("Graph route build failed, falling back to direct route: %s", exc)
        direct_path = [start_node, end_node]
        return _build_route_payload(direct_path, nodes, edge_meta, start, end, mode)


from custom_db import get_zone_data
