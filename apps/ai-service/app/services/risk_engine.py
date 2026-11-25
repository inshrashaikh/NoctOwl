from datetime import datetime
from typing import Dict, List, Tuple, Union
from app.schemas.risk import RiskRequest


def calculate_risk(req: RiskRequest) -> Tuple[float, List[Dict[str, Union[str, float]]]]:
    """
    MVP deterministic risk engine. Returns (risk_score, factors).
    Score in [0, 1]. Higher = riskier.
    Factors are approximate rule contributions, not trained SHAP values yet.
    """
    factors: List[Dict[str, Union[str, float]]] = []
    base = 0.2
    factors.append({"name": "baseline", "contribution": base})

    night_risk = 0.15 if req.is_night else 0.0
    if night_risk > 0:
        factors.append({"name": "nighttime", "contribution": night_risk})

    speed_risk = 0.0
    if req.speed_kmh:
        speed_risk = round(min(req.speed_kmh / 400.0, 0.3), 4)
        factors.append({"name": "speed", "contribution": speed_risk})

    road_risk = 0.0
    road_type = (req.road_type or "").lower()
    if road_type in ("rural", "unpaved", "mountain"):
        road_risk = 0.2
    elif road_type == "urban":
        road_risk = 0.1
    if road_risk > 0:
        factors.append({"name": "road_type", "contribution": road_risk})

    hour_risk = 0.0
    try:
        hour = datetime.fromisoformat(req.timestamp.replace("Z", "+00:00")).hour
        if 0 <= hour <= 4:
            hour_risk = 0.15
        elif 22 <= hour <= 23:
            hour_risk = 0.1
    except ValueError:
        pass
    if hour_risk > 0:
        factors.append({"name": "late_night_hour", "contribution": hour_risk})

    total = min(base + night_risk + speed_risk + road_risk + hour_risk, 1.0)
    return round(total, 4), factors
