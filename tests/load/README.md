# NoctOwl Load Testing (k6)

Load and stress tests for the NoctOwl Core API (`apps/api`) using [Grafana k6](https://k6.io/docs/).

## Install k6

- **macOS (Homebrew)**: `brew install k6`
- **Debian / Ubuntu**:
  ```bash
  sudo gpg -k
  sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
  echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
  sudo apt-get update && sudo apt-get install -y k6
  ```
- **Docker (no local install needed)**:
  ```bash
  docker run --rm --network noctowl-net -i -e BASE_URL=http://api:3000 grafana/k6:latest run - < tests/load/api-smoke.js
  ```

## Scenarios

| Script | Profile | Target Thresholds |
|---|---|---|
| `api-smoke.js` | 10 VUs, 30s (`GET /health`, `POST /auth/otp/request` in setup, `GET /trips`) | `p95 < 500ms`, `rate < 1%` |
| `api-stress.js` | Ramp `10 → 100 → 200 → 0` VUs over 2m (auth + trips + tracking ingest) | `p95 < 1000ms`, `rate < 5%` |
| `tracking-load.js` | 50 VUs sending `POST /trips/:tripId/locations` every 2s for 60s | `p95 < 300ms`, `rate < 1%` |

## Running Tests Against Local Stack

### 1. Obtain a test JWT (`API_TOKEN`) and Active Trip (`TRIP_ID`)

```bash
curl -s -X POST http://localhost:3000/auth/otp/request \
  -H 'Content-Type: application/json' -d '{"phone":"+15550009001"}'
OTP=$(docker exec noctowl-redis redis-cli GET "otp:+15550009001" | python3 -c "import sys,json; print(json.load(sys.stdin)['otp'])")
export API_TOKEN=$(curl -s -X POST http://localhost:3000/auth/otp/verify \
  -H 'Content-Type: application/json' -d "{\"phone\":\"+15550009001\",\"otp\":\"$OTP\"}" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")
export TRIP_ID=$(curl -s -X POST http://localhost:3000/trips \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $API_TOKEN" \
  -d '{"originLat":37.7749,"originLng":-122.4194,"destLat":37.7849,"destLng":-122.4094}' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
curl -s -X PATCH "http://localhost:3000/trips/$TRIP_ID/status" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $API_TOKEN" -d '{"status":"ACTIVE"}' >/dev/null
```

### 2. Execute Smoke, Tracking, and Stress Tests

```bash
k6 run -e BASE_URL=http://localhost:3000 -e API_TOKEN="$API_TOKEN" tests/load/api-smoke.js
```

> **Note on Rate Limiting**: Default API rate limiting allows `100 req/min` per IP (`THROTTLE_LIMIT=100`). For single-IP `tracking-load.js` or `api-stress.js` throughput runs, set `THROTTLE_LIMIT=10000` in your staging/load-test `.env` before starting `api`.

```bash
k6 run -e BASE_URL=http://localhost:3000 -e API_TOKEN="$API_TOKEN" -e TRIP_ID="$TRIP_ID" tests/load/tracking-load.js
k6 run -e BASE_URL=http://localhost:3000 -e API_TOKEN="$API_TOKEN" -e TRIP_ID="$TRIP_ID" tests/load/api-stress.js
```

Save raw JSON output to gitignored `tests/load/results/`:

```bash
k6 run --summary-export=tests/load/results/smoke-summary.json tests/load/api-smoke.js
```

## Interpreting Results & Cadence

- **p95 / p99 (`http_req_duration`)**: Watch for database query or Redis lock contention if `p95` approaches thresholds.
- **Error rate (`http_req_failed`)**: Investigate `5xx` errors in Grafana/Loki/Sentry; `429` indicates rate-limit saturation from single-IP load generation.
- **When to run**: Before every production release, after database schema/index changes, and after infrastructure/resource limit adjustments (never run heavy stress tests against production during peak hours).
