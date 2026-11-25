#!/bin/sh
set -eu

if [ -z "${TARGET_DATABASE_URL:-}" ]; then
  echo "ERROR: TARGET_DATABASE_URL is not set" >&2
  exit 1
fi

CLEAN_TARGET_URL=$(printf '%s' "$TARGET_DATABASE_URL" | sed -E 's/[?&]schema=[^&]*//g; s/\?$//')
REQUESTED="${1:-}"
RESTORE_FILE=""
TEMP_DOWNLOAD=""

cleanup() {
  if [ -n "$TEMP_DOWNLOAD" ] && [ -f "$TEMP_DOWNLOAD" ]; then
    rm -f "$TEMP_DOWNLOAD"
  fi
}
trap cleanup EXIT

MC_BIN=""
if command -v mc >/dev/null 2>&1; then
  MC_BIN="mc"
elif command -v mcli >/dev/null 2>&1; then
  MC_BIN="mcli"
fi

if [ -n "$REQUESTED" ] && [ -f "$REQUESTED" ]; then
  RESTORE_FILE="$REQUESTED"
elif [ -n "$MC_BIN" ] && [ -n "${BACKUP_S3_ENDPOINT:-}" ] && [ -n "${BACKUP_S3_ACCESS_KEY:-}" ] && [ -n "${BACKUP_S3_SECRET_KEY:-}" ]; then
  BUCKET="${BACKUP_S3_BUCKET:-noctowl-backups}"
  "$MC_BIN" alias set minio "$BACKUP_S3_ENDPOINT" "$BACKUP_S3_ACCESS_KEY" "$BACKUP_S3_SECRET_KEY" >/dev/null

  if [ -n "$REQUESTED" ]; then
    OBJECT_NAME="$REQUESTED"
  else
    OBJECT_NAME=$("$MC_BIN" ls "minio/${BUCKET}" | awk '{print $NF}' | grep '^noctowl_.*\.dump$' | sort | tail -n 1)
  fi

  if [ -z "$OBJECT_NAME" ]; then
    echo "ERROR: No backup found in minio/${BUCKET}" >&2
    exit 1
  fi

  TEMP_DOWNLOAD="/tmp/restore_${OBJECT_NAME}"
  echo "Downloading minio/${BUCKET}/${OBJECT_NAME}..."
  "$MC_BIN" cp "minio/${BUCKET}/${OBJECT_NAME}" "$TEMP_DOWNLOAD"
  RESTORE_FILE="$TEMP_DOWNLOAD"
else
  if [ -d /backups ]; then
    SEARCH_DIR="/backups"
  else
    SEARCH_DIR="${BACKUP_DIR:-/tmp/noctowl-backups}"
  fi
  RESTORE_FILE=$(ls -1t "${SEARCH_DIR}"/noctowl_*.dump 2>/dev/null | head -n 1 || true)
fi

if [ -z "$RESTORE_FILE" ] || [ ! -f "$RESTORE_FILE" ]; then
  echo "ERROR: Backup dump file not found" >&2
  exit 1
fi

echo "Restoring ${RESTORE_FILE} into target database..."
pg_restore --clean --if-exists --no-owner --dbname="$CLEAN_TARGET_URL" "$RESTORE_FILE"

USER_COUNT=$(psql "$CLEAN_TARGET_URL" -t -A -c 'SELECT COUNT(*) FROM "User";' | tr -d '[:space:]')
if [ -z "$USER_COUNT" ] || [ "$USER_COUNT" -le 0 ]; then
  echo "ERROR: Verification failed, User table count is ${USER_COUNT:-0}" >&2
  exit 1
fi

echo "Restore verified: User count = ${USER_COUNT}"
exit 0
