"""
Pydantic models for API request/response validation.
"""
from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum


class IncidentType(str, Enum):
    poor_lighting = "poor_lighting"
    felt_followed = "felt_followed"
    broken_cctv = "broken_cctv"
    suspicious_activity = "suspicious_activity"


class ReportRequest(BaseModel):
    lat: float = Field(..., description="Latitude of the incident")
    lng: float = Field(..., description="Longitude of the incident")
    incident_type: IncidentType
    severity: int = Field(..., ge=1, le=5, description="Severity 1 (low) to 5 (critical)")
    source: str = Field(default="user_report")


class ReportResponse(BaseModel):
    success: bool
    message: str
    incident_id: str


class RouteNode(BaseModel):
    intersection_id: str
    lat: float
    lng: float


class SafeRouteResponse(BaseModel):
    route: List[RouteNode]
    coordinates: List[List[float]]
    reason: List[str]
    avoided_intersections: List[str]
    total_distance_m: int
    safety_improvement_vs_shortest: str


class TimeSliceInfo(BaseModel):
    hour: int
    weather: str
    is_weekend: bool
    is_holiday: bool
    special_event: str
    aggregate_safety: float


class ScoreMeta(BaseModel):
    intersection_id: str
    intersection_name: str
    baseline_safety_score: float
    safety_variance: float
    isolation_score: float
    peak_danger_hours: List[int]


class DangerScoreResponse(BaseModel):
    score: int
    comfort_score: int
    comfort_label: str
    risk: str
    reasons: List[str]
    warnings: List[str]
    timeSlice: TimeSliceInfo
    meta: ScoreMeta


class IncidentItem(BaseModel):
    incident_id: str
    incident_type: str
    severity: int
    reported_at: str
    verified: bool
    source: str
    lat: Optional[float] = None
    lng: Optional[float] = None


class IntersectionPoint(BaseModel):
    intersection_id: str
    intersection_name: str
    lat: float
    lng: float
    baseline_safety_score: float
    cluster_id: int
    isolation_score: float
