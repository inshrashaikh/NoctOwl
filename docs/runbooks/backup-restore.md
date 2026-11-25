# Backup & Restore Runbook

## Automated Backups

- **Schedule:** Daily loop (`sleep 86400`) in Docker Compose `backup` service (replace with host `cron` or Kubernetes `CronJob` for production multi-node clusters)
- **Location:** `s3://noctowl-backups/noctowl_YYYYMMDD_HHMMSS.dump` (MinIO/S3-compatible) and `/backups` volume
- **Retention:** 7 days (configurable via `BACKUP_RETENTION_DAYS`)
- **Format:** PostgreSQL custom format (`pg_dump --format=custom --no-owner`)

## Manual Backup

```bash
docker compose exec backup /scripts/backup.sh
```

Or directly from a host with `pg_dump` 16 installed:

```bash
pg_dump "$DATABASE_URL" --format=custom --no-owner -f ./manual.dump
```

## Restore Procedure

### 1. Stop API and Web (prevent concurrent writes)

```bash
docker compose stop api web
```

### 2. Download Latest Backup

```bash
mc alias set minio "$BACKUP_S3_ENDPOINT" "$BACKUP_S3_ACCESS_KEY" "$BACKUP_S3_SECRET_KEY"
mkdir -p ./restore
mc cp "minio/${BACKUP_S3_BUCKET}/" --recursive ./restore/
```

Or restore directly inside the `backup` container (which automatically pulls the latest backup from MinIO):

```bash
docker compose exec -e TARGET_DATABASE_URL="$DATABASE_URL" backup /scripts/restore.sh
```

### 3. Restore to Target Database

```bash
export TARGET_DATABASE_URL="postgresql://noctowl:changeme@localhost:5432/noctowl"
./infrastructure/scripts/restore.sh ./restore/noctowl_YYYYMMDD_HHMMSS.dump
```

### 4. Verify Row Counts

```bash
psql "$TARGET_DATABASE_URL" -c 'SELECT COUNT(*) FROM "User";'
psql "$TARGET_DATABASE_URL" -c 'SELECT COUNT(*) FROM "Trip";'
```

### 5. Restart API and Web

```bash
docker compose up -d api web
```

## Disaster Recovery Verification Test

Run quarterly or before major migrations:

```bash
export ADMIN_DATABASE_URL="postgresql://noctowl:changeme@localhost:5432/postgres"
./infrastructure/scripts/test-restore.sh
```

Expected output: `=== Restore test PASSED ===` with non-zero `Users` count.
