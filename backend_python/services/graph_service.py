# backend_python/services/graph_service.py
import os
from typing import List, Dict, Any
from custom_db.tigergraph_client import get_client
from custom_db.mock_db import get_heatmap_data as mock_get_heatmap, get_mock_zone

DATA_SOURCE = os.getenv("DATA_SOURCE", "mock")

async def get_heatmap_data() -> List[Dict[str, Any]]:
    if DATA_SOURCE == "tigergraph":
        client = get_client()
        # Fallback to mock if tigergraph call not implemented yet
        return mock_get_heatmap() 
    return mock_get_heatmap()

async def get_zone_summary_data(zone_id: str) -> Dict[str, Any]:
    if DATA_SOURCE == "tigergraph":
        # Fallback to mock if tigergraph call not implemented yet
        return get_mock_zone(zone_id)
    return get_mock_zone(zone_id)
