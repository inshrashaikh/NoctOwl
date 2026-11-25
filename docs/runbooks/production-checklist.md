# Production Readiness Checklist

Complete pre-launch verification checklist before routing live production user traffic to NoctOwl.

## Security
- [ ] All secrets stored in environment variables / secret manager (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `POSTGRES_PASSWORD`, `FCM_SERVICE_ACCOUNT_JSON`), never committed to git
- [ ] HTTPS enforced across all external endpoints via reverse proxy (`nginx` / Caddy with automated Let's Encrypt TLS)
- [ ] Helmet security headers enabled (`CSP`, `HSTS`, `X-Frame-Options`, `X-Content-Type-Options`) and `poweredByHeader: false` on Next.js web
- [ ] Global rate limiting (`100/min`) and strict auth OTP rate limiting (`5/min`) verified (`429` on abuse)
- [ ] Strict `CORS_ORIGINS` whitelist configured (no `*` wildcard in production)
- [ ] `SENTRY_DSN_API` and `NEXT_PUBLIC_SENTRY_DSN_WEB` populated with spike protection enabled
- [ ] OWASP ZAP baseline scan (`.github/workflows/dast-scan.yml`) reviewed and clean or accepted exceptions documented in `.zap/rules.tsv`

## Data & Backups
- [ ] Automated daily `pg_dump --format=custom` backup service running and uploading to S3/MinIO ([Backup & Restore Runbook](./backup-restore.md))
- [ ] `./infrastructure/scripts/test-restore.sh` passed against latest production-like dump with verified row counts
- [ ] `npx prisma migrate deploy` tested on staging prior to production rollout
- [ ] Retention policies enforced (`LOKI_URL` compactor `168h` in `infrastructure/observability/loki.yml`, `BACKUP_RETENTION_DAYS=7`, Sentry quota limits)

## Observability
- [ ] Prometheus scrape targets (`api:3000/metrics`, `ai-service:8000/metrics`) reporting `UP`
- [ ] Grafana provisioned with `Prometheus` and `Loki` datasources and `NoctOwl Observability Overview` dashboard
- [ ] Alerting rules configured (API `5xx` error rate > 5%, DB unhealthy, BullMQ queue depth > 1000)
- [ ] Sentry error rate and release tracking monitored
- [ ] Structured JSON logs carrying `service` and `traceId` queryable in Loki

## CI/CD & Release Process
- [ ] `.github/workflows/ci-cd.yml` green on `main` (`lint-and-test` + `backup-restore-test` + `build-and-push`)
- [ ] Trivy container image vulnerability scan passing with zero unmitigated `CRITICAL`/`HIGH` findings
- [ ] Single-VM SSH deploy tested against staging (`docker-compose.yml` + `docker-compose.prod.yml`)
- [ ] Rollback procedure verified in [Incident Response Runbook](./incident-response.md)

## Infrastructure
- [ ] `docker compose -f docker-compose.yml -f docker-compose.prod.yml config` validates cleanly
- [ ] CPU & memory `deploy.resources` limits configured for every service in `docker-compose.prod.yml`
- [ ] Restart policies (`restart: always`) verified on all production containers
- [ ] Host disk usage monitoring & alert configured (`df -h` threshold `< 80%`)

## Documentation
- [ ] Root [README.md](../../README.md) contains local setup, port map, and deployment secret requirements
- [ ] [Backup & Restore](./backup-restore.md) and [Incident Response](./incident-response.md) runbooks reviewed
- [ ] Interactive Swagger/OpenAPI docs accessible at `/api-docs`
- [ ] [Managed Services Migration Guide](../migration/managed-services.md) and [Multi-Region Considerations](../architecture/multi-region.md) current

## Load & Performance
- [ ] `k6 run tests/load/api-smoke.js` passed against staging (`p95 < 500ms`, error rate `< 1%`)
- [ ] `k6 run tests/load/tracking-load.js` passed (`p95 < 300ms`, error rate `< 1%`)
- [ ] `p95` latency and `p99` baseline recorded in [Load Testing README](../../tests/load/README.md)
