#!/bin/sh
# Daily backup: PostgreSQL dumps for dashboard + authentik, plus a tar of the
# log directory. Keeps the last 14 days; older files are pruned.
set -eu

STAMP=$(date +%Y-%m-%d_%H%M)
OUT=/backups
mkdir -p "$OUT"

echo "[$(date)] backup start"

# --- Dashboard DB ---
PGPASSWORD="$DB_PASSWORD" pg_dump -h db -U "$DB_USER" "$DB_USER" \
  | gzip > "$OUT/dashboard-${STAMP}.sql.gz"
echo "  ✓ dashboard DB dumped"

# --- Authentik DB ---
PGPASSWORD="$AUTHENTIK_DB_PASSWORD" pg_dump -h authentik-db -U authentik authentik \
  | gzip > "$OUT/authentik-${STAMP}.sql.gz"
echo "  ✓ authentik DB dumped"

# --- Logs ---
if [ -d /var/log/dashboard ]; then
  tar -czf "$OUT/logs-${STAMP}.tar.gz" -C /var/log/dashboard . 2>/dev/null || true
  echo "  ✓ logs archived"
fi

# --- Retention: 14 days ---
find "$OUT" -type f -name "*.gz" -mtime +14 -delete

echo "[$(date)] backup done"
