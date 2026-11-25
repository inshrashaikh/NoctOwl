from typing import List, Optional
from pydantic import BaseModel, Field


class RiskFactor(BaseModel):
    name: str
    contribution: float


class RiskRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    timestamp: str
    speed_kmh: Optional[float] = Field(None, ge=0)
    heading: Optional[float] = Field(None, ge=0, le=360)
    road_type: Optional[str] = None
    is_night: bool = True


class RiskResponse(BaseModel):
    risk_score: float = Field(..., ge=0.0, le=1.0)
    factors: List[RiskFactor]
