#!/usr/bin/env python3
"""Load local Chandigarh mock graph data into PostgreSQL."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
import sys
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend_python"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import asyncpg

from config import POSTGRES_DB, POSTGRES_HOST, POSTGRES_PASSWORD, POSTGRES_PORT, POSTGRES_USER

DATA_DIR = ROOT / "data"
GRAPH_DATA = DATA_DIR / "chandigarh_graph_data.json"
VERTICES_FILE = DATA_DIR / "chandigarh_vertices.json"
EDGES_FILE = DATA_DIR / "chandigarh_edges.json"


def _read_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def _unwrap(value: Any) -> Any:
    if isinstance(value, dict) and set(value.keys()) == {"value"}:
        return value["value"]
    return value


def _flatten_node(node: dict[str, Any]) -> dict[str, Any]:
    return {key: _unwrap(value) for key, value in node.items()}


def _find_vertices_and_edges() -> tuple[dict[str, Any], list[dict[str, Any]]]:
    if GRAPH_DATA.exists():
        data = _read_json(GRAPH_DATA)
        return data.get("vertices", {}), data.get("edges", [])

    vertices = _read_json(VERTICES_FILE).get("vertices", {}) if VERTICES_FILE.exists() else {}
    edges = _read_json(EDGES_FILE).get("edges", []) if EDGES_FILE.exists() else []
    return vertices, edges


def _extract_zone_vertices(vertices: dict[str, Any]) -> list[dict[str, Any]]:
    zones: list[dict[str, Any]] = []
    for _, entries in vertices.items():
        if not isinstance(entries, dict):
            continue
        for vertex_id, raw in entries.items():
            node = _flatten_node(raw)
            if "latitude" not in node or "longitude" not in node:
                continue
            zone_id = str(node.get("intersection_id") or node.get("zone_id") or vertex_id)
            zones.append({
                "zone_id": zone_id,
                "name": node.get("intersection_name") or node.get("name") or zone_id,
                "latitude": node.get("latitude"),
                "longitude": node.get("longitude"),
                "danger_score": node.get("danger_score", node.get("baseline_safety_score", 0)) or 0,
            })
    return zones


def _extract_incidents(vertices: dict[str, Any], edges: list[dict[str, Any]]) -> list[dict[str, Any]]:
    incidents: list[dict[str, Any]] = []
    for vertex_type, entries in vertices.items():
        if vertex_type != "Incident" or not isinstance(entries, dict):
            continue
        for incident_id, raw in entries.items():
            node = _flatten_node(raw)
            zone_id = node.get("location_id") or node.get("zone_id")
            incidents.append({
                "incident_id": str(node.get("incident_id") or incident_id),
                "zone_id": str(zone_id) if zone_id is not None else None,
                "incident_type": node.get("incident_type") or node.get("type") or "incident",
                "payload": node,
            })

    if incidents:
        return incidents

    for edge in edges:
        if edge.get("from_type") != "Incident":
            continue
        payload = {
            "from_type": edge.get("from_type"),
            "from_id": edge.get("from_id"),
            "to_type": edge.get("to_type"),
            "to_id": edge.get("to_id"),
            "edge_type": edge.get("edge_type"),
            "attributes": edge.get("attributes", {}),
        }
        incidents.append({
            "incident_id": str(edge.get("from_id")),
            "zone_id": str(edge.get("to_id")) if edge.get("to_id") is not None else None,
            "incident_type": str(edge.get("edge_type") or "incident"),
            "payload": payload,
        })
    return incidents


async def _connect() -> asyncpg.Pool:
    return await asyncpg.create_pool(
        host=POSTGRES_HOST,
        port=POSTGRES_PORT,
        database=POSTGRES_DB,
        user=POSTGRES_USER,
        password=POSTGRES_PASSWORD,
    )


async def _upsert_zones(pool: asyncpg.Pool, zones: list[dict[str, Any]]) -> None:
    query = """
        INSERT INTO zones (zone_id, name, latitude, longitude, danger_score)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (zone_id) DO UPDATE
        SET name = EXCLUDED.name,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            danger_score = EXCLUDED.danger_score
    """
    async with pool.acquire() as conn:
        for index, zone in enumerate(zones, start=1):
            await conn.execute(
                query,
                zone["zone_id"],
                zone["name"],
                zone["latitude"],
                zone["longitude"],
                zone.get("danger_score", 0),
            )
            print(f"[zones] {index}/{len(zones)} upserted: {zone['zone_id']}")


async def _upsert_incidents(pool: asyncpg.Pool, incidents: list[dict[str, Any]]) -> None:
    query = """
        INSERT INTO incidents (incident_id, zone_id, incident_type, payload)
        VALUES ($1, $2, $3, $4::jsonb)
        ON CONFLICT (incident_id) DO UPDATE
        SET zone_id = EXCLUDED.zone_id,
            incident_type = EXCLUDED.incident_type,
            payload = EXCLUDED.payload
    """
    async with pool.acquire() as conn:
        for index, incident in enumerate(incidents, start=1):
            await conn.execute(
                query,
                incident["incident_id"],
                incident.get("zone_id"),
                incident["incident_type"],
                json.dumps(incident["payload"]),
            )
            print(f"[incidents] {index}/{len(incidents)} upserted: {incident['incident_id']}")


async def main() -> None:
    vertices, edges = _find_vertices_and_edges()
    zones = _extract_zone_vertices(vertices)
    incidents = _extract_incidents(vertices, edges)

    print(f"Loading from {GRAPH_DATA.name if GRAPH_DATA.exists() else 'split vertex/edge JSON files'}")
    print(f"Found {len(zones)} zones and {len(incidents)} incidents")

    pool = await _connect()
    try:
        await _upsert_zones(pool, zones)
        await _upsert_incidents(pool, incidents)
    finally:
        await pool.close()

    print("Import complete")


if __name__ == "__main__":
    asyncio.run(main())
