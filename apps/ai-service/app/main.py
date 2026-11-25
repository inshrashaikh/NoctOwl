from typing import Dict
from fastapi import FastAPI
from app.config import settings
from app.metrics import metrics_endpoint
from app.routers import risk

app = FastAPI(title="NoctOwl AI Service", version=settings.version)
app.include_router(risk.router, prefix="/risk", tags=["risk"])


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok", "service": settings.service_name}


@app.get("/metrics")
def metrics():
    return metrics_endpoint()
