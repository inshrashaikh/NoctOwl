#!/bin/sh
set -eu

if [ -z "${ADMIN_DATABASE_URL:-}" ]; then
  echo "ERROR: ADMIN_DATABASE_URL is not set" >&2
  exit 1
fi

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
CLEAN_ADMIN_URL=$(printf '%s' "$ADMIN_DATABASE_URL" | sed -E 's/[?&]schema=[^&]*//g; s/\?$//')
BASE_URL="${CLEAN_ADMIN_URL%/*}"
TEST_DB="noctowl_restore_test"

cleanup() {
  psql "$CLEAN_ADMIN_URL" -c "DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE);" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "=== Creating test database ==="
psql "$CLEAN_ADMIN_URL" -c "DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE);" >/dev/null
psql "$CLEAN_ADMIN_URL" -c "CREATE DATABASE ${TEST_DB};"

export TARGET_DATABASE_URL="${BASE_URL}/${TEST_DB}"
psql "$TARGET_DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS postgis;" >/dev/null

echo "=== Restoring latest backup ==="
"$SCRIPT_DIR/restore.sh" "${1:-}"

echo "=== Verifying row counts ==="
USER_COUNT=$(psql "$TARGET_DATABASE_URL" -t -A -c 'SELECT COUNT(*) FROM "User";' | tr -d '[:space:]')
TRIP_COUNT=$(psql "$TARGET_DATABASE_URL" -t -A -c 'SELECT COUNT(*) FROM "Trip";' | tr -d '[:space:]')
echo "Users: ${USER_COUNT}, Trips: ${TRIP_COUNT}"

if [ -z "$USER_COUNT" ] || [ "$USER_COUNT" -eq 0 ]; then
  echo "FAIL: User table empty after restore" >&2
  exit 1
fi

echo "=== Dropping test database ==="
psql "$CLEAN_ADMIN_URL" -c "DROP DATABASE ${TEST_DB} WITH (FORCE);"
trap - EXIT

echo "=== Restore test PASSED ==="
