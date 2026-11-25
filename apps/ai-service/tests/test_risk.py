from fastapi.testclient import TestClient
from app.schemas.risk import RiskRequest
from app.services.risk_engine import calculate_risk


def test_baseline_score_in_range() -> None:
    req = RiskRequest(
        lat=12.9716,
        lon=77.5946,
        timestamp="2026-11-24T14:00:00Z",
        is_night=False,
    )
    score, factors = calculate_risk(req)
    assert 0.0 <= score <= 1.0
    assert len(factors) > 0
    assert all("name" in f and "contribution" in f for f in factors)


def test_night_flag_increases_score() -> None:
    day_req = RiskRequest(
        lat=12.9716,
        lon=77.5946,
        timestamp="2026-11-24T14:00:00Z",
        is_night=False,
    )
    night_req = RiskRequest(
        lat=12.9716,
        lon=77.5946,
        timestamp="2026-11-24T14:00:00Z",
        is_night=True,
    )
    day_score, _ = calculate_risk(day_req)
    night_score, night_factors = calculate_risk(night_req)
    assert night_score > day_score
    assert any(f["name"] == "nighttime" for f in night_factors)


def test_high_speed_increases_score() -> None:
    slow_req = RiskRequest(
        lat=12.9716,
        lon=77.5946,
        timestamp="2026-11-24T14:00:00Z",
        speed_kmh=20.0,
        is_night=False,
    )
    fast_req = RiskRequest(
        lat=12.9716,
        lon=77.5946,
        timestamp="2026-11-24T14:00:00Z",
        speed_kmh=100.0,
        is_night=False,
    )
    slow_score, _ = calculate_risk(slow_req)
    fast_score, fast_factors = calculate_risk(fast_req)
    assert fast_score > slow_score
    assert any(f["name"] == "speed" for f in fast_factors)


def test_rural_road_type_increases_score() -> None:
    highway_req = RiskRequest(
        lat=12.9716,
        lon=77.5946,
        timestamp="2026-11-24T14:00:00Z",
        road_type="highway",
        is_night=False,
    )
    rural_req = RiskRequest(
        lat=12.9716,
        lon=77.5946,
        timestamp="2026-11-24T14:00:00Z",
        road_type="rural",
        is_night=False,
    )
    urban_req = RiskRequest(
        lat=12.9716,
        lon=77.5946,
        timestamp="2026-11-24T14:00:00Z",
        road_type="urban",
        is_night=False,
    )
    highway_score, _ = calculate_risk(highway_req)
    urban_score, _ = calculate_risk(urban_req)
    rural_score, rural_factors = calculate_risk(rural_req)
    assert rural_score > urban_score > highway_score
    assert any(f["name"] == "road_type" for f in rural_factors)


def test_late_night_hour_increases_score() -> None:
    day_req = RiskRequest(
        lat=12.9716,
        lon=77.5946,
        timestamp="2026-11-24T14:00:00Z",
        is_night=True,
    )
    late_req = RiskRequest(
        lat=12.9716,
        lon=77.5946,
        timestamp="2026-11-24T02:00:00Z",
        is_night=True,
    )
    late_evening_req = RiskRequest(
        lat=12.9716,
        lon=77.5946,
        timestamp="2026-11-24T22:30:00Z",
        is_night=True,
    )
    day_score, _ = calculate_risk(day_req)
    late_score, late_factors = calculate_risk(late_req)
    evening_score, _ = calculate_risk(late_evening_req)
    assert late_score > evening_score > day_score
    assert any(f["name"] == "late_night_hour" for f in late_factors)


def test_score_never_exceeds_one() -> None:
    extreme_req = RiskRequest(
        lat=12.9716,
        lon=77.5946,
        timestamp="2026-11-24T02:00:00Z",
        speed_kmh=250.0,
        road_type="rural",
        is_night=True,
    )
    score, factors = calculate_risk(extreme_req)
    assert score <= 1.0
    assert len(factors) > 0


def test_invalid_timestamp_does_not_crash() -> None:
    req = RiskRequest(
        lat=12.9716,
        lon=77.5946,
        timestamp="not-an-iso-timestamp",
        is_night=True,
    )
    score, _ = calculate_risk(req)
    assert 0.0 <= score <= 1.0


def test_health_and_assess_endpoints(client: TestClient) -> None:
    health_res = client.get("/health")
    assert health_res.status_code == 200
    assert health_res.json() == {"status": "ok", "service": "ai-service"}

    assess_res = client.post(
        "/risk/assess",
        json={
            "lat": 12.9716,
            "lon": 77.5946,
            "timestamp": "2026-11-24T02:00:00Z",
            "speed_kmh": 60.0,
            "heading": 90.0,
            "road_type": "urban",
            "is_night": True,
        },
    )
    assert assess_res.status_code == 200
    body = assess_res.json()
    assert 0.0 <= body["risk_score"] <= 1.0
    assert isinstance(body["factors"], list)
    assert len(body["factors"]) >= 3
