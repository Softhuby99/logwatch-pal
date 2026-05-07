#!/usr/bin/env bash
# Pull latest dashboard code from git and rebuild the API container.
# Run on the log server: cd /opt/dashboard && bash deploy/sync.sh
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/dashboard}"
cd "$REPO_DIR"

echo "[sync] git fetch + reset to origin/main"
git fetch --all --prune
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
git reset --hard "origin/${BRANCH}"

echo "[sync] current commit: $(git rev-parse --short HEAD) ($(git log -1 --pretty=%s))"

cd "$REPO_DIR/deploy"

echo "[sync] rebuilding api (no cache) and forcing recreate"
docker compose build --no-cache api
docker compose up -d --force-recreate api

# Poll until /api/version answers (or give up after 30s and dump logs)
echo "[sync] waiting for API to come up…"
ok=0
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3001/api/version >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 1
done

if [ "$ok" -ne 1 ]; then
  echo "[sync] API did not respond within 30s — dumping container logs:"
  docker logs --tail=80 deploy-api-1 || true
  echo "[sync] container status:"
  docker ps -a --filter name=deploy-api-1 --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
  exit 1
fi

echo "[sync] running API version:"
curl -fsS http://127.0.0.1:3001/api/version; echo
echo "[sync] SSH pubkey:"
curl -fsS http://127.0.0.1:3001/api/ssh/pubkey || echo "  (pubkey endpoint not reachable)"
echo
echo "[sync] done."
