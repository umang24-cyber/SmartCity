"""
backend_python/db/tigergraph_client.py
========================================
Backward-compatibility shim.
All logic has moved to custom_db/tigergraph_client.py.
Import from there directly in new code.
"""
from custom_db.tigergraph_client import (  # noqa: F401
    TigerGraphClient,
    get_client,
    get_zone_data,
    get_all_zones,
    update_zone_danger_score,
    upsert_incident_to_graph,
)
