#!/bin/sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set" >&2
  exit 1
fi

CLEAN_DB_URL=$(printf '%s' "$DATABASE_URL" | sed -E 's/[?&]schema=[^&]*//g; s/\?$//')
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

if [ -d /backups ] && [ -w /backups ]; then
  BACKUP_DIR="/backups"
else
  BACKUP_DIR="${BACKUP_DIR:-/tmp/noctowl-backups}"
  mkdir -p "$BACKUP_DIR"
fi

TIMESTAMP=$(date -u +%Y%m%d_%H%M%S)
FILENAME="noctowl_${TIMESTAMP}.dump"
DUMP_PATH="${BACKUP_DIR}/${FILENAME}"

echo "Starting pg_dump to ${DUMP_PATH}..."
if ! pg_dump "$CLEAN_DB_URL" --format=custom --no-owner --file="$DUMP_PATH"; then
  echo "ERROR: pg_dump failed" >&2
  rm -f "$DUMP_PATH"
  exit 1
fi

MC_BIN=""
if command -v mc >/dev/null 2>&1; then
  MC_BIN="mc"
elif command -v mcli >/dev/null 2>&1; then
  MC_BIN="mcli"
fi

if [ -n "$MC_BIN" ] && [ -n "${BACKUP_S3_ENDPOINT:-}" ] && [ -n "${BACKUP_S3_ACCESS_KEY:-}" ] && [ -n "${BACKUP_S3_SECRET_KEY:-}" ]; then
  BUCKET="${BACKUP_S3_BUCKET:-noctowl-backups}"
  "$MC_BIN" alias set minio "$BACKUP_S3_ENDPOINT" "$BACKUP_S3_ACCESS_KEY" "$BACKUP_S3_SECRET_KEY" >/dev/null
  "$MC_BIN" mb --ignore-existing "minio/${BUCKET}" >/dev/null
  if ! "$MC_BIN" cp "$DUMP_PATH" "minio/${BUCKET}/${FILENAME}"; then
    echo "ERROR: Failed to upload ${FILENAME} to minio/${BUCKET}" >&2
    exit 1
  fi
  echo "Uploaded to s3://${BUCKET}/${FILENAME}"
  "$MC_BIN" rm --recursive --force --older-than "${RETENTION_DAYS}d" "minio/${BUCKET}/" >/dev/null 2>&1 || true
fi

find "$BACKUP_DIR" -maxdepth 1 -type f -name "noctowl_*.dump" -mtime "+${RETENTION_DAYS}" -delete 2>/dev/null || true

SIZE_BYTES=$(wc -c < "$DUMP_PATH" | tr -d ' ')
echo "Backup succeeded: ${DUMP_PATH} (${SIZE_BYTES} bytes)"
exit 0
