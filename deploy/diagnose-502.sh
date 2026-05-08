#!/usr/bin/env bash
# Read-only diagnostic for the 502 between OPNsense -> Authentik -> Dashboard -> API.
# Makes NO changes. Run on the log server:
#   cd /opt/dashboard && bash deploy/diagnose-502.sh
set -u

REPO_DIR="${REPO_DIR:-/opt/dashboard}"
cd "$REPO_DIR/deploy"

# Load .env if present (for DASHBOARD_PORT, AUTHENTIK_URL, HOSTNAME, ...)
if [ -f .env ]; then
  set -a; . ./.env; set +a
fi

DASHBOARD_PORT="${DASHBOARD_PORT:-8080}"
PUBLIC_URL="${PUBLIC_URL:-https://logdash.servuswir.de}"
AUTHENTIK_INTERNAL="${AUTHENTIK_INTERNAL:-https://192.168.3.12:9443/}"

hr() { printf '\n========== %s ==========\n' "$1"; }

hr "0) Versions / Host"
date
docker --version 2>/dev/null || true
docker compose version 2>/dev/null || true

hr "1) docker compose ps (api + dashboard)"
docker compose ps api dashboard 2>&1 || docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E 'api|dashboard' || true

hr "2) API direkt auf dem Host (127.0.0.1:3001/api/version)"
curl -sS -m 5 -o /tmp/diag_api.out -w "HTTP=%{http_code} TIME=%{time_total}s\n" http://127.0.0.1:3001/api/version
echo "Body:"; head -c 300 /tmp/diag_api.out; echo

hr "3) Dashboard-Container auf Host-Port (127.0.0.1:${DASHBOARD_PORT}/)"
curl -sS -m 5 -o /tmp/diag_dash.out -w "HTTP=%{http_code} TIME=%{time_total}s\n" "http://127.0.0.1:${DASHBOARD_PORT}/" || echo "  -> Connection failed"
echo "Body (first 200B):"; head -c 200 /tmp/diag_dash.out; echo

hr "3b) Dashboard-Container auf Host-Port /api/version (interner Nginx -> api)"
curl -sS -m 5 -o /tmp/diag_dash_api.out -w "HTTP=%{http_code} TIME=%{time_total}s\n" "http://127.0.0.1:${DASHBOARD_PORT}/api/version" || echo "  -> Connection failed"
echo "Body:"; head -c 300 /tmp/diag_dash_api.out; echo

hr "4) Dashboard -> API intern via Docker-DNS (api:3001)"
docker compose exec -T dashboard sh -c 'wget -qO- --timeout=5 http://api:3001/api/version || echo "WGET-FAIL"' 2>&1 | head -c 500; echo

hr "4b) Dashboard nslookup auf 'api' (zeigt stale DNS)"
docker compose exec -T dashboard sh -c 'getent hosts api 2>/dev/null || nslookup api 2>/dev/null || echo "no resolver tool"' 2>&1 | head -c 400; echo

hr "5) Authentik-Outpost direkt (${AUTHENTIK_INTERNAL})"
curl -skI -m 5 "${AUTHENTIK_INTERNAL}" | head -n 5 || echo "  -> not reachable"

hr "6a) OPNsense Edge: ${PUBLIC_URL}/"
curl -skI -m 8 "${PUBLIC_URL}/" | head -n 5 || echo "  -> not reachable"

hr "6b) OPNsense Edge: ${PUBLIC_URL}/api/version"
curl -skI -m 8 "${PUBLIC_URL}/api/version" | head -n 5 || echo "  -> not reachable"

hr "7) Letzte 50 Logzeilen: api"
docker compose logs --tail=50 api 2>&1 | tail -n 50

hr "7b) Letzte 50 Logzeilen: dashboard"
docker compose logs --tail=50 dashboard 2>&1 | tail -n 50

hr "FERTIG"
cat <<EOF
Auswertung:
  - 2) muss 200 + Version liefern  (API selbst ok?)
  - 3) muss 200 liefern             (Dashboard-Container lebt + Port-Bind ok?)
  - 3b)/4) muss Version liefern     (interner Nginx -> api: stale DNS?)
  - 5) 200/302                      (Authentik-Outpost ok?)
  - 6a/6b) zeigt wo OPNsense 502 wirft
EOF
