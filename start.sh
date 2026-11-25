#!/bin/bash
# ============================================================
# NoctOwl — Single-Command Full Stack Launcher
# Usage:  ./start.sh [--no-mobile] [--no-build]
# ============================================================
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NO_MOBILE=false
NO_BUILD=false

for arg in "$@"; do
  case $arg in
    --no-mobile) NO_MOBILE=true ;;
    --no-build)  NO_BUILD=true  ;;
  esac
done

# ── Colours ────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[noctowl]${RESET} $*"; }
success() { echo -e "${GREEN}[noctowl]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[noctowl]${RESET} $*"; }
error()   { echo -e "${RED}[noctowl]${RESET} $*"; exit 1; }

# ── Detect LAN IP ──────────────────────────────────────────
LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
if [ -z "$LAN_IP" ]; then
  LAN_IP=$(ip route get 1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1); exit}')
fi
if [ -z "$LAN_IP" ]; then
  warn "Could not auto-detect LAN IP. Mobile will use localhost."
  LAN_IP="localhost"
fi

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║        🦉  NoctOwl Full Stack Launcher        ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${RESET}"
echo ""
info "LAN IP detected: ${BOLD}$LAN_IP${RESET}"
echo ""

# ── Prerequisites ──────────────────────────────────────────
command -v docker  >/dev/null 2>&1 || error "docker not found. Install Docker first."
command -v docker compose >/dev/null 2>&1 || \
  docker-compose version >/dev/null 2>&1   || \
  error "docker compose not found."

# ── 1. Docker Compose Stack ────────────────────────────────
info "Starting Docker services (API · Web · AI · DB · Redis · MinIO · Observability · Valhalla)…"

COMPOSE_CMD="docker compose -f $ROOT/docker-compose.yml -f $ROOT/docker-compose.dev.yml"

if [ "$NO_BUILD" = false ]; then
  $COMPOSE_CMD up -d --build
else
  $COMPOSE_CMD up -d
fi

success "Docker stack started."

# ── 2. Wait for API health ──────────────────────────────────
info "Waiting for API to be healthy…"
MAX_WAIT=60
WAITED=0
until curl -sf "http://localhost:3000/health" >/dev/null 2>&1; do
  sleep 2
  WAITED=$((WAITED + 2))
  if [ "$WAITED" -ge "$MAX_WAIT" ]; then
    warn "API not healthy after ${MAX_WAIT}s — continuing anyway."
    break
  fi
done
[ "$WAITED" -lt "$MAX_WAIT" ] && success "API healthy."

# ── 3. Expo Mobile Dev Server ───────────────────────────────
EXPO_PID=""
if [ "$NO_MOBILE" = false ]; then
  if command -v npx >/dev/null 2>&1; then
    info "Starting Expo mobile dev server (API → http://$LAN_IP:3000)…"
    cd "$ROOT/apps/mobile"

    # Write a .env.local so app.config.js picks it up without rebuild
    cat > "$ROOT/apps/mobile/.env.local" <<EOF
EXPO_PUBLIC_API_URL=http://$LAN_IP:3000
EXPO_PUBLIC_SOCKET_URL=http://$LAN_IP:3000
EOF

    EXPO_PUBLIC_API_URL="http://$LAN_IP:3000" \
    EXPO_PUBLIC_SOCKET_URL="http://$LAN_IP:3000" \
    npx expo start --clear 2>&1 &
    EXPO_PID=$!
    success "Expo started (PID $EXPO_PID). Scan the QR code with your phone."
    cd "$ROOT"
  else
    warn "npx not found — skipping Expo. Install Node.js to enable mobile dev server."
  fi
else
  info "Mobile dev server skipped (--no-mobile)."
fi

# ── 4. Summary ─────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║            🚀  Services Running               ║${RESET}"
echo -e "${BOLD}╠══════════════════════════════════════════════╣${RESET}"
echo -e "║  API (NestJS)    →  http://localhost:3000      ║"
echo -e "║  API Docs        →  http://localhost:3000/api-docs"
echo -e "║  Web (Next.js)   →  http://localhost:3002      ║"
echo -e "║  AI Service      →  http://localhost:8000      ║"
echo -e "║  Grafana         →  http://localhost:3001      ║"
echo -e "║  Prometheus      →  http://localhost:9090      ║"
echo -e "║  MinIO Console   →  http://localhost:9001      ║"
echo -e "║  Valhalla        →  http://localhost:8002      ║"
echo -e "╠══════════════════════════════════════════════╣"
echo -e "║  LAN IP  →  ${BOLD}$LAN_IP${RESET}"
echo -e "║  Mobile API URL  →  http://$LAN_IP:3000"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop the Expo server.${RESET}"
echo -e "${YELLOW}To stop Docker: docker compose down${RESET}"
echo ""

# ── 5. Keep alive (wait for Expo or Ctrl-C) ────────────────
if [ -n "$EXPO_PID" ]; then
  wait "$EXPO_PID" 2>/dev/null || true
fi
