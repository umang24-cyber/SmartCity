"""
backend_python/db/tigergraph_client.py
========================================
Async TigerGraph client with transparent mock fallback.

Architecture decisions:
- All blocking pyTigerGraph calls are offloaded to a thread pool via
  asyncio.get_event_loop().run_in_executor() so the FastAPI event loop
  is never blocked.
- A module-level singleton (_client) is used so the connection is
  established once at application startup (lifespan), not per-request.
- When USE_MOCK_DB=true or pyTigerGraph is unavailable, every method
  falls back to db/mock_db.py data — no exceptions propagate to callers.
- Connection errors are logged as warnings (not errors), so the server
  starts cleanly even without TigerGraph.

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
from typing import Any, Optional

from config import (
    TIGERGRAPH_HOST,
    TIGERGRAPH_PORT,
    TIGERGRAPH_GRAPH,
    TIGERGRAPH_USERNAME,
    TIGERGRAPH_PASSWORD,
    USE_MOCK_DB,
)

logger = logging.getLogger(__name__)

# ── Optional pyTigerGraph import ──────────────────────────────────────────────
try:
    import pyTigerGraph as tg  # type: ignore[import]
    _TG_AVAILABLE = True
except ImportError:
    _TG_AVAILABLE = False
    logger.warning(
        "pyTigerGraph is not installed — TigerGraph features unavailable. "
        "Falling back to mock DB. Install with: pip install pyTigerGraph"
    )


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

        Called once during FastAPI lifespan startup. Safe to call when
        USE_MOCK_DB=true — exits immediately without raising.
        """
        if USE_MOCK_DB:
            logger.info("USE_MOCK_DB=true — skipping TigerGraph connection")
            return
        if not _TG_AVAILABLE:
            logger.warning("pyTigerGraph not installed — running in mock mode")
            return

        host = f"{TIGERGRAPH_HOST}:{TIGERGRAPH_PORT}"
        logger.info("Connecting to TigerGraph at %s (graph=%s) …", host, TIGERGRAPH_GRAPH)
        try:
            self._conn = tg.TigerGraphConnection(
                host=TIGERGRAPH_HOST,
                graphname=TIGERGRAPH_GRAPH,
                username=TIGERGRAPH_USERNAME,
                password=TIGERGRAPH_PASSWORD,
                restppPort=str(TIGERGRAPH_PORT),
            )
            # Generate and store a REST++ token
            secret = self._conn.createSecret()
            self._conn.getToken(secret)
            self.connected = True
            logger.info("✅ TigerGraph connected (graph=%s)", TIGERGRAPH_GRAPH)
        except Exception as exc:
            logger.warning(
                "TigerGraph connection failed: %s. Serving mock data instead.", exc
            )
            self._conn = None
            self.connected = False

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
        if not self.connected:
            return _mock_upsert(vertex_type, vertex_id, attributes)

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            lambda: self._conn.upsertVertex(vertex_type, vertex_id, attributes),
        )

    async def get_vertex(
        self,
        vertex_type: str,
        vertex_id: str,
    ) -> Optional[dict]:
        """
        Returns vertex attributes dict or None if not found.
        """
        if not self.connected:
            return None   # callers fall back to mock helpers

        loop = asyncio.get_event_loop()
        try:
            result = await loop.run_in_executor(
                None,
                lambda: self._conn.getVerticesById(vertex_type, vertex_id),
            )
            if result:
                return result[0].get("attributes", {})
        except Exception as exc:
            logger.warning("get_vertex(%s, %s) failed: %s", vertex_type, vertex_id, exc)
        return None

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
        if not self.connected:
            return []

        loop = asyncio.get_event_loop()
        try:
            kwargs: dict = {"limit": limit}
            if where:
                kwargs["where"] = where
            result = await loop.run_in_executor(
                None,
                lambda: self._conn.getVertices(vertex_type, **kwargs),
            )
            return [
                {"v_id": v.get("v_id"), **v.get("attributes", {})}
                for v in (result or [])
            ]
        except Exception as exc:
            logger.warning("get_vertices(%s) failed: %s", vertex_type, exc)
            return []

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
        if not self.connected:
            return _mock_upsert_edge(from_type, from_id, edge_type, to_type, to_id)

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            lambda: self._conn.upsertEdge(
                from_type, from_id, edge_type, to_type, to_id, attributes or {}
            ),
        )

    # ── Query operations ──────────────────────────────────────────────────────

    async def run_installed_query(
        self,
        query_name: str,
        params: Optional[dict] = None,
    ) -> Any:
        """
        Executes a pre-installed GSQL query and returns the result.
        Returns an empty list on failure or mock mode.
        """
        if not self.connected:
            return _mock_query(query_name, params)

        loop = asyncio.get_event_loop()
        try:
            return await loop.run_in_executor(
                None,
                lambda: self._conn.runInstalledQuery(query_name, params or {}),
            )
        except Exception as exc:
            logger.warning("runInstalledQuery(%s) failed: %s", query_name, exc)
            return []

    async def run_interpreted_query(self, gsql: str) -> Any:
        """
        Executes an ad-hoc GSQL query (not pre-installed).
        Use sparingly — interpreted queries are slower than installed ones.
        """
        if not self.connected:
            return []

        loop = asyncio.get_event_loop()
        try:
            return await loop.run_in_executor(
                None,
                lambda: self._conn.gsql(gsql),
            )
        except Exception as exc:
            logger.warning("run_interpreted_query failed: %s", exc)
            return []


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
# These are the functions imported by services/*.py — they abstract over
# whether we are using real TigerGraph or mock data.


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

    Falls back silently to the mock incident store when disconnected.
    """
    client = get_client()
    vertex_id: str = payload["vertex_id"]
    attributes: dict = payload.get("attributes", {})

    if not client.connected:
        # Persist to in-memory session store for the demo
        from custom_db.mock_db import add_mock_incident
        add_mock_incident({"incident_id": vertex_id, **attributes})
        logger.debug("Mock upsert incident: %s", vertex_id)
        return

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

    Falls back to mock data when TigerGraph is unavailable or the zone
    does not exist in the live graph.
    """
    client = get_client()
    if client.connected:
        result = await client.get_vertex("Zone", zone_id)
        if result:
            return result

    # Mock fallback
    from custom_db.mock_db import get_mock_zone, _rng
    zone = get_mock_zone(zone_id)
    if zone:
        return zone
    # For unknown zone IDs (dynamically computed from lat/lng) generate stable mock
    return {
        "zone_id": zone_id,
        "danger_score": round(_rng.uniform(0.2, 0.7), 3),
        "historical_danger_score": round(_rng.uniform(0.2, 0.6), 3),
        "incident_count_24h": _rng.randint(0, 8),
        "feature_vectors": None,
        "recent_data": [
            {"hour": h, "incident_count": _rng.randint(0, 4), "crowd": round(_rng.uniform(0.1, 0.8), 2)}
            for h in range(24)
        ],
    }


async def update_zone_danger_score(zone_id: str, danger_score: float) -> None:
    """Updates the danger_score attribute of a Zone vertex."""
    client = get_client()
    if client.connected:
        await client.upsert_vertex("Zone", zone_id, {"danger_score": danger_score})
    else:
        # Update mock store if the zone exists there
        from custom_db.mock_db import MOCK_ZONES
        if zone_id in MOCK_ZONES:
            MOCK_ZONES[zone_id]["danger_score"] = round(danger_score, 3)
        logger.debug("Mock zone update: %s → danger_score=%.3f", zone_id, danger_score)


async def get_all_zones(limit: int = 200) -> list[dict]:
    """
    Returns all Zone vertices for the heatmap layer.

    Falls back to mock zones when disconnected.
    """
    client = get_client()
    if client.connected:
        zones = await client.get_vertices("Zone", limit=limit)
        if zones:
            return zones

    from custom_db.mock_db import get_all_mock_zones
    return get_all_mock_zones()


# ── Mock stubs (used internally when client is disconnected) ──────────────────

def _mock_upsert(vtype: str, vid: str, attrs: dict) -> dict:
    logger.debug("MOCK upsert %s:%s → %s", vtype, vid, attrs)
    return {"upserted": 1}


def _mock_upsert_edge(ft: str, fid: str, etype: str, tt: str, tid: str) -> dict:
    logger.debug("MOCK edge %s:%s --%s--> %s:%s", ft, fid, etype, tt, tid)
    return {"upserted": 1}


def _mock_query(qname: str, params: Optional[dict]) -> list:
    logger.debug("MOCK query %s(%s)", qname, params)
    return []
