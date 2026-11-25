# NoctOwl

Safety-oriented night-travel companion platform featuring route safety scoring, real-time companion tracking, AI-assisted risk analysis, admin oversight, and full-stack observability.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2+)

## Quick Start

1. Create your local environment file from the example template:

   ```bash
   cp .env.example .env
   ```

2. Start the full development stack (database, cache, API, AI service, web admin console, Prometheus, Loki, Promtail, Grafana):

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
   ```

3. Verify service endpoints locally:
   - **Core API**: `http://localhost:3000` (`GET /health`, `GET /metrics`)
   - **Grafana**: `http://localhost:3001` (default `admin` / `admin`)
   - **Admin Web Dashboard**: `http://localhost:3002`
   - **AI Risk Service**: `http://localhost:8000` (`GET /health`, `GET /metrics`)
   - **Prometheus**: `http://localhost:9090` (`/targets`)
   - **Loki**: `http://localhost:3100`

4. Stop services when finished:

   ```bash
   docker compose down
   ```

## Valhalla Routing Tiles

Place Valhalla tiles in `infrastructure/routing/` before running. For development, use a minimal tile set or mock Valhalla responses in tests.

## Production Deployment & CI/CD (M7)

The GitHub Actions workflow in `.github/workflows/ci-cd.yml` runs on pushes to `main` / `develop`, PRs to `main`, and releases:

1. **Lint & Test**: runs `api`, `web`, and `ai-service` test suites and typechecks.
2. **Build, Trivy Scan & Push**: builds images for `api`, `web`, and `ai-service`, fails on `CRITICAL`/`HIGH` vulnerabilities via Trivy before pushing, and pushes images to GHCR (`ghcr.io/<owner>/<repo>/<service>`).
3. **Single-VM Deploy (`main` pushes only)**: copies Compose and `infrastructure/` files to `/opt/noctowl/` and deploys via `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`.

### Required GitHub Secrets

Configure these repository secrets in GitHub before enabling automated deployments:

- `DEPLOY_HOST` — Target VM IP address or hostname
- `DEPLOY_USER` — SSH username with Docker access on the target VM
- `DEPLOY_SSH_KEY` — Private SSH key matching `~/.ssh/authorized_keys` on the VM

### Target VM Prerequisites

- Docker Engine + Docker Compose v2 installed
- `/opt/noctowl/.env` populated with production secrets (`DATABASE_URL`, `POSTGRES_PASSWORD`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGINS`, `SENTRY_DSN_*`, `GITHUB_REPOSITORY`)

### Production Override Validation

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml config
```

## Operations, Retention & Runbooks (M8)

- **Log Retention**: Loki compactor enforces a `168h` (7-day) retention window via `infrastructure/observability/loki.yml`.
- **Sentry Quota Management**:
  - `tracesSampleRate` is capped at `0.1` (10% sampling) across API and Web SDKs.
  - Enable **Spike Protection** and monthly error caps (e.g., 5,000 events/month on Developer plan) in Sentry Project Settings.
  - `beforeSend` in `apps/api/src/instrument.ts` drops `/health` probe noise before transmission.
- **Database Backups**: Daily `pg_dump --format=custom` uploads to MinIO/S3 (`BACKUP_RETENTION_DAYS=7`) via `infrastructure/scripts/backup.sh`.
- **Runbooks**:
  - [Backup & Restore Runbook](docs/runbooks/backup-restore.md)
  - [Incident Response Runbook](docs/runbooks/incident-response.md)
