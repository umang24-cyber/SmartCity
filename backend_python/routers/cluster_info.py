import os
from fastapi import APIRouter, HTTPException, Query
from data.mock_data import MOCK_CLUSTERS, MOCK_INTERSECTIONS
import utils.tigergraph as tg

router = APIRouter()

DATA_SOURCE = os.getenv("DATA_SOURCE", "mock")


@router.get("/", summary="Get cluster info by cluster_id or intersection_id")
async def get_cluster_info(
    cluster_id: int = Query(default=None, description="Cluster ID"),
    intersection_id: str = Query(default=None, description="Intersection ID (to look up cluster)"),
):
    try:
        # Resolve cluster_id from intersection if needed
        resolved_cluster_id = cluster_id

        if not resolved_cluster_id and intersection_id:
            intersection = next(
                (i for i in MOCK_INTERSECTIONS if i["intersection_id"] == intersection_id),
                None,
            )
            if intersection:
                resolved_cluster_id = intersection["cluster_id"]

        if DATA_SOURCE == "tigergraph":
            cluster = await tg.get_cluster(resolved_cluster_id or 1)
        else:
            if resolved_cluster_id:
                cluster = next((c for c in MOCK_CLUSTERS if c["cluster_id"] == resolved_cluster_id), None)
            else:
                cluster = MOCK_CLUSTERS[0]

        if not cluster:
            raise HTTPException(status_code=404, detail="Cluster not found")

        return cluster

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch cluster info: {str(e)}")
