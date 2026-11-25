from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from fastapi import Response

risk_requests_total = Counter(
    "noctowl_risk_requests_total",
    "Total risk assessments processed by the NoctOwl AI service",
    ["status"],
)
risk_duration_seconds = Histogram(
    "noctowl_risk_duration_seconds",
    "Duration of risk assessment calculations in seconds",
)


def metrics_endpoint() -> Response:
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
