import os
from fastapi import APIRouter, HTTPException, Query
from data.mock_data import MOCK_INTERSECTIONS, MOCK_SAFETY_FEATURES, get_current_time_slice
from utils.safety_engine import compute_safety_score
import utils.tigergraph as tg

router = APIRouter()

DATA_SOURCE = os.getenv("DATA_SOURCE", "mock")


@router.get("/", summary="Get danger/comfort score for an intersection")
async def get_danger_score(
    intersection_id: str = Query(default="INT_001", description="Intersection ID"),
    weather: str = Query(default="clear", description="Current weather condition"),
):
    try:
        if DATA_SOURCE == "tigergraph":
            intersection = await tg.get_intersection(intersection_id)
            features = await tg.get_features_for_intersection(intersection_id)
            time_slice = await tg.get_current_time_slice()
            time_slice["weather_condition"] = weather
        else:
            intersection = next(
                (i for i in MOCK_INTERSECTIONS if i["intersection_id"] == intersection_id),
                MOCK_INTERSECTIONS[0],
            )
            features = MOCK_SAFETY_FEATURES
            time_slice = {**get_current_time_slice(), "weather_condition": weather}

        result = compute_safety_score(intersection, time_slice, features)
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute danger score: {str(e)}")
