"""
backend_python/db/postgres_client.py
===================================
Async PostgreSQL client with strict real-database mode.

This module provides the same helper API previously used by the graph-backed
implementation, but routes the work through PostgreSQL using asyncpg.
"""

import asyncio
import logging
import math
from typing import Any, Optional

import asyncpg

from config import (
    POSTGRES_DB,
    POSTGRES_HOST,
    POSTGRES_PASSWORD,
    POSTGRES_PORT,
    POSTGRES_USER,
)

logger = logging.getLogger(__name__)


class PostgresClient:
    """Async wrapper around an asyncpg connection pool."""

    def __init__(self) -> None:
        self.pool: asyncpg.Pool | None = None
        self.connected: bool = False

    async def connect(self):
        """Create the PostgreSQL connection pool."""
        if self.pool is not None and self.connected:
            return

        self.pool = await asyncpg.create_pool(
            host=POSTGRES_HOST,
            port=POSTGRES_PORT,
            database=POSTGRES_DB,
            user=POSTGRES_USER,
            password=POSTGRES_PASSWORD,
        )
        self.connected = True

    async def close(self):
        """Close the PostgreSQL connection pool."""
        if self.pool is not None:
            await self.pool.close()
        self.pool = None
        self.connected = False

    def _require_connection(self) -> asyncpg.Pool:
        if not self.connected or self.pool is None:
            raise RuntimeError("PostgreSQL client is not connected")
        return self.pool

    @staticmethod
    def _record_to_dict(record: Optional[asyncpg.Record]) -> Optional[dict]:
        if record is None:
            return None
        return dict(record)

    async def get_zone(self, zone_id: str) -> Optional[dict]:
        pool = self._require_connection()
        query = """
            SELECT *
            FROM zones
            WHERE zone_id = $1 OR id = $1
            LIMIT 1
        """
        async with pool.acquire() as conn:
            record = await conn.fetchrow(query, zone_id)
        return self._record_to_dict(record)

    async def get_all_zones(self, limit: int = 200) -> list[dict]:
        pool = self._require_connection()
        query = """
            SELECT *
            FROM zones
            ORDER BY zone_id NULLS LAST, id NULLS LAST
            LIMIT $1
        """
        async with pool.acquire() as conn:
            records = await conn.fetch(query, limit)
        return [dict(record) for record in records]

    async def update_zone_danger_score(self, zone_id: str, danger_score: float) -> None:
        pool = self._require_connection()
        query = """
            UPDATE zones
            SET danger_score = $2
            WHERE zone_id = $1 OR id = $1
        """
        async with pool.acquire() as conn:
            await conn.execute(query, zone_id, danger_score)

    async def insert_incident(self, payload: dict) -> None:
        pool = self._require_connection()
        vertex_id = payload.get("vertex_id")
        attributes = payload.get("attributes", {})
        incident_type = payload.get("vertex_type", "Incident")
        zone_id = None
        edges = payload.get("edges", [])
        for edge in edges:
            if edge.get("edge_type") == "OCCURRED_AT":
                zone_id = edge.get("to_vertex_id")
                break

        query = """
            INSERT INTO incidents (
                incident_id,
                incident_type,
                zone_id,
                payload
            )
            VALUES ($1, $2, $3, $4::jsonb)
            ON CONFLICT (incident_id) DO UPDATE
            SET incident_type = EXCLUDED.incident_type,
                zone_id = EXCLUDED.zone_id,
                payload = EXCLUDED.payload
        """
        async with pool.acquire() as conn:
            await conn.execute(
                query,
                vertex_id,
                incident_type,
                zone_id,
                asyncpg.types.Json(attributes),
            )


_client = PostgresClient()


def get_client() -> PostgresClient:
    return _client


async def upsert_incident_to_graph(payload: dict) -> None:
    client = get_client()
    await client.insert_incident(payload)


async def get_zone_data(zone_id: str) -> dict:
    client = get_client()
    result = await client.get_zone(zone_id)
    if result:
        result.setdefault("zone_id", result.get("zone_id", result.get("id", zone_id)))
        return result

    if "_" in zone_id:
        try:
            lat_s, lng_s = zone_id.split("_", 1)
            lat = float(lat_s)
            lng = float(lng_s)
        except ValueError:
            raise RuntimeError("PostgreSQL client is not connected")

        zones = await get_all_zones(limit=10000)
        if not zones:
            raise RuntimeError("PostgreSQL client is not connected")

        nearest = min(
            zones,
            key=lambda z: math.hypot(
                float(z.get("lat", z.get("latitude", 0.0))) - lat,
                float(z.get("lng", z.get("lon", z.get("longitude", 0.0)))) - lng,
            ),
        )
        nearest.setdefault("zone_id", nearest.get("zone_id", nearest.get("id")))
        return nearest

    raise RuntimeError("PostgreSQL client is not connected")


async def update_zone_danger_score(zone_id: str, danger_score: float) -> None:
    client = get_client()
    await client.update_zone_danger_score(zone_id, danger_score)


async def get_all_zones(limit: int = 200) -> list[dict]:
    client = get_client()
    zones = await client.get_all_zones(limit=limit)
    if not zones:
        raise RuntimeError("PostgreSQL client is not connected")
    for zone in zones:
        zone.setdefault("zone_id", zone.get("zone_id", zone.get("id")))
    return zones
