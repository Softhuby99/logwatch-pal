#!/bin/sh
# Backup container entrypoint: install psql + cron, then run crond in foreground.
set -eu

apk add --no-cache postgresql16-client tar gzip dcron tzdata >/dev/null

# Render crontab from BACKUP_CRON env var
mkdir -p /etc/crontabs
echo "${BACKUP_CRON} /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1" > /etc/crontabs/root
touch /var/log/backup.log

echo "[backup] cron installed: ${BACKUP_CRON}"
echo "[backup] running once at startup..."
/usr/local/bin/backup.sh || echo "[backup] initial run failed (non-fatal)"

# Foreground cron
crond -f -l 8
