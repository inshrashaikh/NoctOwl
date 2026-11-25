def test_metrics_endpoint_exposes_risk_counters(client):
    payload = {
        "lat": 37.7749,
        "lon": -122.4194,
        "timestamp": "2026-11-25T23:15:00Z",
        "speed_kmh": 45.0,
        "road_type": "urban",
        "is_night": True,
    }
    assess_resp = client.post("/risk/assess", json=payload)
    assert assess_resp.status_code == 200

    metrics_resp = client.get("/metrics")
    assert metrics_resp.status_code == 200
    body = metrics_resp.text
    assert "noctowl_risk_requests_total" in body
    assert 'status="success"' in body
    assert "noctowl_risk_duration_seconds" in body
