# Managed Services Migration Guide

Migration path from self-hosted Docker Compose services to managed cloud services. This document describes **how and when** to migrate without altering current M9 single-VM deployments.

---

## 1. PostgreSQL + PostGIS → Managed

- **Options**: AWS RDS for PostgreSQL (with `postgis` extension), Google Cloud SQL for PostgreSQL, Azure Database for PostgreSQL Flexible Server.
- **Migration Steps**:
  1. Provision managed PostgreSQL 16 instance and enable PostGIS:
     ```sql
     CREATE EXTENSION IF NOT EXISTS postgis;
     ```
  2. Export from self-hosted container in PostgreSQL custom format:
     ```bash
     pg_dump "$SOURCE_DATABASE_URL" --format=custom --no-owner -f noctowl_migration.dump
     ```
  3. Restore to managed instance:
     ```bash
     pg_restore --clean --if-exists --no-owner --dbname="$MANAGED_DATABASE_URL" noctowl_migration.dump
     ```
  4. Update `DATABASE_URL` in `.env` / secret manager and deploy migrations:
     ```bash
     cd apps/api && npx prisma migrate deploy
     ```
  5. Verify row counts (`User`, `Trip`, `TripLocation`, `SafeZone`) against source DB.
- **Connection Pooling**: Use PgBouncer (or RDS Proxy / Cloud SQL Auth Proxy) in `transaction` pooling mode if API horizontally scales past ~100 concurrent DB connections; configure `connection_limit` in `DATABASE_URL`.
- **Backups**: Enable automated daily snapshots (7–35 day retention) + Point-in-Time Recovery (PITR) WAL archiving, replacing the Docker `backup` loop.

---

## 2. Redis → Managed

- **Options**: AWS ElastiCache for Redis, Google Cloud Memorystore, Azure Cache for Redis.
- **Migration**:
  - Cache entries (OTP codes, refresh token hashes, geofence inside/outside state, route cache) are ephemeral/reconstructible — no cold dump required if switching during a maintenance window.
  - Drain or pause BullMQ `emergency-notifications` queue workers briefly (`docker compose stop api`), update `REDIS_URL` / `REDIS_HOST` / `REDIS_PORT`, and restart `api`.
- **BullMQ Durability**: Enable **Append-Only File (`appendonly yes`)** / multi-AZ replication on the managed Redis instance and set `maxmemory-policy noeviction` so BullMQ job keys are never evicted under memory pressure.

---

## 3. MinIO → Amazon S3 (or GCS / Azure Blob)

- **Migration**:
  1. Create a private versioned S3 bucket (`noctowl-backups`) with lifecycle expiration matching `BACKUP_RETENTION_DAYS`.
  2. Sync existing backups using `mc mirror`:
     ```bash
     mc alias set minio "$BACKUP_S3_ENDPOINT" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
     mc alias set s3 https://s3.amazonaws.com "$AWS_ACCESS_KEY_ID" "$AWS_SECRET_ACCESS_KEY"
     mc mirror --overwrite minio/noctowl-backups s3/noctowl-backups
     ```
  3. Update `BACKUP_S3_ENDPOINT=https://s3.amazonaws.com` and `BACKUP_S3_BUCKET=noctowl-backups` (or switch `backup.sh` to `aws s3 cp`).
- **IAM Security**: In production AWS/GCP, attach IAM instance/task roles (`s3:PutObject`, `s3:GetObject`, `s3:ListBucket`) instead of static `BACKUP_S3_ACCESS_KEY` / `BACKUP_S3_SECRET_KEY` credentials.

---

## 4. AI Service → Managed Container Platform

- **Options**: AWS ECS Fargate, Google Cloud Run, Azure Container Apps.
- **Migration**:
  1. Push built image (`ghcr.io/<org>/noctowl/ai-service:<tag>`) or mirror to ECR/Artifact Registry.
  2. Deploy behind internal load balancer / service discovery (port `8000`, healthcheck `/health`).
  3. Update `AI_SERVICE_URL` in API environment (e.g., `http://ai-service.internal:8000`) and enable autoscaling on CPU / request concurrency.
- **Note**: FastAPI (`apps/ai-service`) is completely stateless, making horizontal scaling and zero-downtime blue/green cutover straightforward.

---

## 5. Web + API → Managed Container Platform

- **Options**: AWS ECS Fargate / Google Cloud Run / Azure Container Apps behind HTTPS load balancer (ALB / Cloud Load Balancing).
- **Sticky Sessions / WebSockets**: Since `apps/api` runs Socket.IO (`/tracking` namespace), attach `@socket.io/redis-adapter` using managed Redis before scaling API beyond 1 replica.
- **When to stay on Single VM**: Below ~5K–10K DAU, single-VM Docker Compose keeps cost and latency low with zero orchestrator overhead.

---

## 6. Decision Matrix — When to Migrate

| Signal | Threshold | Recommended Action |
|---|---|---|
| Daily Active Users (DAU) | `> 10,000` DAU or sustained DB CPU `> 65%` | Migrate PostgreSQL + Redis to managed HA services |
| Operational Overhead | Backup/patching/monitoring consumes `> 4 hrs/week` | Move stateful services (RDS, ElastiCache, S3) first |
| Availability SLA | Single-VM downtime window unacceptable (`99.9%+` SLA) | Multi-AZ managed DB + multi-replica ECS/Cloud Run |
| Cost Comparison | Managed surcharge `<` engineering hours saved | Migrate stateful DB/storage before stateless compute |
