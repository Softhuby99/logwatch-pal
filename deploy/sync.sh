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

sleep 4
echo "[sync] running API version:"
curl -fsS http://127.0.0.1:3001/api/version || echo "  (version endpoint not reachable yet)"
echo
echo "[sync] SSH pubkey:"
curl -fsS http://127.0.0.1:3001/api/ssh/pubkey || echo "  (pubkey endpoint not reachable)"
echo
echo "[sync] done."
