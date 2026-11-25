from time import perf_counter
from fastapi import APIRouter, HTTPException
from app.metrics import risk_duration_seconds, risk_requests_total
from app.schemas.risk import RiskFactor, RiskRequest, RiskResponse
from app.services.risk_engine import calculate_risk

router = APIRouter()


@router.post("/assess", response_model=RiskResponse)
async def assess_risk(request: RiskRequest) -> RiskResponse:
    start = perf_counter()
    try:
        score, factors = calculate_risk(request)
        risk_requests_total.labels(status="success").inc()
        return RiskResponse(
            risk_score=score,
            factors=[RiskFactor(**factor) for factor in factors],
        )
    except ValueError as exc:
        risk_requests_total.labels(status="error").inc()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        risk_requests_total.labels(status="error").inc()
        raise HTTPException(status_code=500, detail="Risk assessment failed") from exc
    finally:
        risk_duration_seconds.observe(perf_counter() - start)
