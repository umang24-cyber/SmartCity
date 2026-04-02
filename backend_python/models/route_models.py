"""
backend_python/models/route_models.py
========================================
Pydantic v2 models for the safe-route endpoint.

  GET /api/v1/safe-route?origin_lat=&origin_lng=&dest_lat=&dest_lng=
                         → SafeRouteResponse
"""

from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field


class RouteSegment(BaseModel):
    """
    A single node (intersection / waypoint) on a safe route.

    All coordinate values are decimal degrees WGS-84.
    """

    node_id: str = Field(..., description="Zone or intersection identifier")
    lat: float = Field(..., ge=-90.0, le=90.0)
    lng: float = Field(..., ge=-180.0, le=180.0)
    safety_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Combined safety score (1.0 = perfectly safe)",
    )
    name: Optional[str] = Field(
        default=None,
        description="Human-readable place name if available",
    )


class SafeRouteRequest(BaseModel):
    """
    Query parameters object for the safe-route search.

    Not used directly as a request body (the endpoint uses Query params),
    but useful for internal function signatures.
    """

    origin_lat: float = Field(..., ge=-90.0, le=90.0)
    origin_lng: float = Field(..., ge=-180.0, le=180.0)
    dest_lat: float = Field(..., ge=-90.0, le=90.0)
    dest_lng: float = Field(..., ge=-180.0, le=180.0)
    max_detour_factor: float = Field(
        default=1.5,
        ge=1.0,
        le=5.0,
        description="Max acceptable route length as a multiple of the shortest path",
    )


class SafeRouteResponse(BaseModel):
    """
    Response for the safe-route endpoint.

    *route* is an ordered list of waypoints from origin to destination.
    *coordinates* is the flattened [[lat, lng], …] version for use with
    MapLibre GL JS's GeoJSON source.
    """

    route: list[RouteSegment]
    coordinates: list[list[float]] = Field(
        ...,
        description="List of [lat, lng] pairs in traversal order",
    )
    reason: list[str] = Field(
        ...,
        description="Ordered list of human-readable reasons why this route was chosen",
    )
    avoided_nodes: list[str] = Field(
        default_factory=list,
        description="Node IDs deliberately excluded due to high danger",
    )
    total_distance_m: int = Field(..., ge=0, description="Approximate route length in metres")
    safety_improvement: str = Field(
        ...,
        description="e.g. '+18 points vs shortest path'",
    )
    average_safety_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Mean safety score across all waypoints",
    )
