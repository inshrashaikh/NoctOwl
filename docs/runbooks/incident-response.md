# Incident Response Runbook

## 1. Emergency Notification Failures

**Symptoms:** `noctowl_emergency_notifications_total{status="failed"}` rises in Grafana/Prometheus, or `BullMQ Queue Depth` grows continuously.

1. Check Grafana **NoctOwl Observability Overview** (`http://localhost:3001`) panels:
   - `Emergency Notification Delivery Rate`
   - `BullMQ Queue Depth`
   - `Service Error Logs (Loki)`
2. Inspect API logs in Loki (`{service="api"} |~ "(?i)(fcm|notification|error)"`) using `traceId` to correlate HTTP request -> BullMQ processor.
3. Verify Redis health and BullMQ queue state:
   ```bash
   docker compose exec redis redis-cli PING
   docker compose logs --tail 100 api
   ```
4. Verify Firebase credentials (`FCM_SERVICE_ACCOUNT_JSON`) in `.env` / production secret store; if misconfigured, update secret and restart `api`.

## 2. Database Down or Unhealthy

**Symptoms:** `/health` fails, API 5xx spike in Sentry/Grafana, `noctowl-postgres` restarts or exits.

1. Check container status, logs, and host disk space:
   ```bash
   docker compose ps
   docker compose logs --tail 100 postgres
   df -h
   ```
2. If disk is full, prune old unused Docker images (`docker system prune -f`) and inspect `/var/lib/postgresql/data` / Loki retention (`168h`).
3. If database corruption or accidental deletion occurred, follow [Backup & Restore Runbook](./backup-restore.md).

## 3. API 5xx Spike

**Symptoms:** Grafana **API p95 Latency** or 5xx status rates spike; Sentry alerts fire.

1. Check Sentry for grouped stack traces (tagged with environment and release).
2. Query Loki for correlated traces: `{service="api", level="error"}` and filter by `traceId`.
3. Verify downstream dependencies (`ai-service`, `valhalla`, `postgres`, `redis`):
   ```bash
   curl -fsS http://localhost:3000/health
   curl -fsS http://localhost:8000/health
   ```
4. Check container resource usage (`docker stats --no-stream`).

## 4. Escalation & Rollback

- **Escalation:** Primary on-call checks Sentry + Grafana within 15 minutes; escalate to infrastructure lead if database restore or VM intervention is required.
- **Rollback to previous image tag:**
  ```bash
  cd /opt/noctowl
  export TAG="<previous-known-good-sha>"
  docker compose -f docker-compose.yml -f docker-compose.prod.yml pull api web ai-service
  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --remove-orphans
  ```
