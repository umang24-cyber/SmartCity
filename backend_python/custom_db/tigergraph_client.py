"""
backend_python/db/tigergraph_client.py
========================================
Async TigerGraph client with strict real-database mode.

Architecture decisions:
- All blocking pyTigerGraph calls are offloaded to a thread pool via
  asyncio.get_event_loop().run_in_executor() so the FastAPI event loop
  is never blocked.
- A module-level singleton (_client) is used so the connection is
  established once at application startup (lifespan), not per-request.
- Any connection/query failure raises RuntimeError with
  "TigerGraph connection failed: ..." and does not fall back to mock data.

Usage:
    # In lifespan:
    from custom_db.tigergraph_client import get_client
    get_client().connect()

    # In a service:
    from custom_db.tigergraph_client import get_zone_data
    zone = await get_zone_data("zone_1")
"""

import asyncio
import logging
import math
import threading
from typing import Any, Optional

from config import (
    TIGERGRAPH_HOST,
    TIGERGRAPH_GRAPH,
    TIGERGRAPH_TOKEN,
)

logger = logging.getLogger(__name__)

try:
    import pyTigerGraph as tg  # type: ignore[import]
except ImportError as exc:
    tg = None
    _IMPORT_ERROR = exc
else:
    _IMPORT_ERROR = None


def _bootstrap_pytigergraph(token: str) -> None:
    auth_header = {"Authorization": f"Bearer {token}", "X-User-Agent": "pyTigerGraph"}
    tg.TigerGraphConnection._cached_token_auth = auth_header
    tg.TigerGraphConnection._cached_pwd_auth = auth_header
    tg.TigerGraphConnection._local = threading.local()
    tg.TigerGraphConnection._restpp_failover_lock = threading.Lock()


# ── Client class ──────────────────────────────────────────────────────────────

class TigerGraphClient:
    """
    Async wrapper around pyTigerGraph.TigerGraphConnection.

    All public methods are coroutines. Blocking SDK calls run in the
    default executor (thread pool) to avoid stalling the event loop.
    """

    def __init__(self) -> None:
        self._conn: Any = None  # pyTigerGraph connection object
        self.connected: bool = False

    # ── Connection ────────────────────────────────────────────────────────────

    def connect(self) -> None:
        """
        Establishes a TigerGraph connection synchronously.

        Called once during FastAPI lifespan startup.
        """
        if _IMPORT_ERROR is not None:
            raise RuntimeError(
                f"TigerGraph connection failed: pyTigerGraph is not installed ({_IMPORT_ERROR})"
            ) from _IMPORT_ERROR
        if not TIGERGRAPH_HOST or not TIGERGRAPH_GRAPH or not TIGERGRAPH_TOKEN:
            raise RuntimeError(
                "TigerGraph connection failed: missing one or more required values "
                "(TG_HOST, TG_GRAPHNAME, TG_TOKEN)"
            )

        logger.info("Connecting to TigerGraph...")
        try:
            _bootstrap_pytigergraph(TIGERGRAPH_TOKEN)
            self._conn = tg.TigerGraphConnection(
                host=TIGERGRAPH_HOST,
                graphname=TIGERGRAPH_GRAPH,
                apiToken=TIGERGRAPH_TOKEN,
            )
            try:
                logger.info("Running test query...")
                test_result = self._conn.getVertexTypes()
            except Exception:
                self._conn = tg.TigerGraphConnection(
                    host=TIGERGRAPH_HOST,
                    graphname=TIGERGRAPH_GRAPH,
                    jwtToken=TIGERGRAPH_TOKEN,
                )
                logger.info("Running test query...")
                test_result = self._conn.getVertexTypes()
            logger.info("Query success")
            print(self._conn.echo())
            logger.info("TigerGraph connected successfully")
            logger.info("Vertex types: %s", test_result)
            self.connected = True
        except Exception as exc:
            self._conn = None
            self.connected = False
            raise RuntimeError(f"TigerGraph connection failed: {exc}") from exc

    def _require_connection(self) -> Any:
        if not self.connected or self._conn is None:
            raise RuntimeError("TigerGraph connection failed: client is not connected")
        return self._conn

    # ── Vertex operations ─────────────────────────────────────────────────────

    async def upsert_vertex(
        self,
        vertex_type: str,
        vertex_id: str,
        attributes: dict,
    ) -> dict:
        """
        Upserts (creates or updates) a vertex.

        Returns {"upserted": 1} on success (matches TigerGraph response shape).
        """
        conn = self._require_connection()
        loop = asyncio.get_event_loop()
        try:
            return await loop.run_in_executor(
                None,
                lambda: conn.upsertVertex(vertex_type, vertex_id, attributes),
            )
        except Exception as exc:
            raise RuntimeError(f"TigerGraph connection failed: {exc}") from exc

    async def get_vertex(
        self,
        vertex_type: str,
        vertex_id: str,
    ) -> Optional[dict]:
        """
        Returns vertex attributes dict or None if not found.
        """
        conn = self._require_connection()
        loop = asyncio.get_event_loop()
        try:
            result = await loop.run_in_executor(
                None,
                lambda: conn.getVerticesById(vertex_type, vertex_id),
            )
            if result:
                return {"v_id": result[0].get("v_id", vertex_id), **result[0].get("attributes", {})}
            return None
        except Exception as exc:
            raise RuntimeError(f"TigerGraph connection failed: {exc}") from exc

    async def get_vertices(
        self,
        vertex_type: str,
        where: str = "",
        limit: int = 1000,
    ) -> list[dict]:
        """
        Returns a list of vertex attribute dicts of *vertex_type*,
        optionally filtered with a TigerGraph WHERE expression.
        """
        conn = self._require_connection()
        loop = asyncio.get_event_loop()
        try:
            kwargs: dict = {"limit": limit}
            if where:
                kwargs["where"] = where
            result = await loop.run_in_executor(
                None,
                lambda: conn.getVertices(vertex_type, **kwargs),
            )
            return [
                {"v_id": v.get("v_id"), **v.get("attributes", {})}
                for v in (result or [])
            ]
        except Exception as exc:
            raise RuntimeError(f"TigerGraph connection failed: {exc}") from exc

    # ── Edge operations ───────────────────────────────────────────────────────

    async def upsert_edge(
        self,
        from_type: str,
        from_id: str,
        edge_type: str,
        to_type: str,
        to_id: str,
        attributes: Optional[dict] = None,
    ) -> dict:
        """Upserts a directed edge between two existing vertices."""
        conn = self._require_connection()
        loop = asyncio.get_event_loop()
        try:
            return await loop.run_in_executor(
                None,
                lambda: conn.upsertEdge(
                    from_type, from_id, edge_type, to_type, to_id, attributes or {}
                ),
            )
        except Exception as exc:
            raise RuntimeError(f"TigerGraph connection failed: {exc}") from exc

    # ── Query operations ──────────────────────────────────────────────────────

    async def run_installed_query(
        self,
        query_name: str,
        params: Optional[dict] = None,
    ) -> Any:
        """
        Executes a pre-installed GSQL query and returns the result.
        Returns query result.
        """
        conn = self._require_connection()
        loop = asyncio.get_event_loop()
        try:
            return await loop.run_in_executor(
                None,
                lambda: conn.runInstalledQuery(query_name, params or {}),
            )
        except Exception as exc:
            raise RuntimeError(f"TigerGraph connection failed: {exc}") from exc

    async def run_interpreted_query(self, gsql: str) -> Any:
        """
        Executes an ad-hoc GSQL query (not pre-installed).
        Use sparingly — interpreted queries are slower than installed ones.
        """
        conn = self._require_connection()
        loop = asyncio.get_event_loop()
        try:
            return await loop.run_in_executor(
                None,
                lambda: conn.gsql(gsql),
            )
        except Exception as exc:
            raise RuntimeError(f"TigerGraph connection failed: {exc}") from exc


# ── Module-level singleton ────────────────────────────────────────────────────

_client = TigerGraphClient()


def get_client() -> TigerGraphClient:
    """
    Returns the module-level TigerGraph client singleton.

    The client is connected during lifespan startup.  Callers that need
    the client outside the lifespan (e.g. tests) should call
    get_client().connect() first.
    """
    return _client


# ── High-level service helpers ────────────────────────────────────────────────


async def upsert_incident_to_graph(payload: dict) -> None:
    """
    Inserts an Incident vertex and its OCCURRED_AT edge into TigerGraph.

    *payload* is the ``graph_payload`` dict produced by nlp_service.py:
        {
            "vertex_type": "Incident",
            "vertex_id": "<report_id>",
            "attributes": {...},
            "edges": [{"edge_type": "OCCURRED_AT", "to_vertex_type": "Zone", ...}]
        }

    Persists to TigerGraph only.
    """
    client = get_client()
    vertex_id: str = payload["vertex_id"]
    attributes: dict = payload.get("attributes", {})

    await client.upsert_vertex(payload["vertex_type"], vertex_id, attributes)
    for edge in payload.get("edges", []):
        to_id = edge.get("to_vertex_id")
        if to_id:
            await client.upsert_edge(
                payload["vertex_type"], vertex_id,
                edge["edge_type"],
                edge["to_vertex_type"], to_id,
            )


async def get_zone_data(zone_id: str) -> dict:
    """
    Returns a Zone vertex dict for *zone_id*.

    Returns a Zone vertex dict for *zone_id* or nearest Zone for lat_lng IDs.
    """
    client = get_client()
    result = None
    try:
        result = await client.get_vertex("Zone", zone_id)
    except RuntimeError as exc:
        if "not a valid vertex type" not in str(exc):
            raise
    if not result:
        result = await client.get_vertex("Intersection", zone_id)
    if result:
        result.setdefault("zone_id", result.get("v_id", zone_id))
        return result

    if "_" in zone_id:
        try:
            lat_s, lng_s = zone_id.split("_", 1)
            lat = float(lat_s)
            lng = float(lng_s)
        except ValueError:
            raise RuntimeError(f"TigerGraph connection failed: zone not found for id '{zone_id}'")
        zones = await get_all_zones(limit=10000)
        if not zones:
            raise RuntimeError("TigerGraph connection failed: no Zone vertices available")
        nearest = min(
            zones,
            key=lambda z: math.hypot(
                float(z.get("lat", z.get("latitude", 0.0))) - lat,
                float(z.get("lng", z.get("lon", z.get("longitude", 0.0)))) - lng,
            ),
        )
        nearest.setdefault("zone_id", nearest.get("v_id"))
        return nearest

    raise RuntimeError(f"TigerGraph connection failed: zone not found for id '{zone_id}'")


async def update_zone_danger_score(zone_id: str, danger_score: float) -> None:
    """Updates the danger_score attribute of a Zone vertex."""
    client = get_client()
    try:
        await client.upsert_vertex("Zone", zone_id, {"danger_score": danger_score})
    except Exception:
        await client.upsert_vertex("Intersection", zone_id, {"danger_score": danger_score})


async def get_all_zones(limit: int = 200) -> list[dict]:
    """
    Returns all Zone vertices for the heatmap layer.

    Returns all Zone vertices for the heatmap layer.
    """
    client = get_client()
    zones: list[dict] = []
    try:
        zones = await client.get_vertices("Zone", limit=limit)
    except RuntimeError as exc:
        if "not a valid vertex type" not in str(exc):
            raise
    if not zones:
        zones = await client.get_vertices("Intersection", limit=limit)
    if not zones:
        raise RuntimeError("TigerGraph connection failed: no Zone or Intersection vertices returned")
    for zone in zones:
        zone.setdefault("zone_id", zone.get("v_id"))
    return zones
