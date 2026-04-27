#!/usr/bin/env bash
# install.sh – Bootstrap the dashboard stack on Debian 12 / 13.
# - Verifies/installs Docker
# - Creates host-side users (LOG_SRV_USER + dashboard-admin) with fixed UIDs
# - Prepares directories (./certs, ./backups, ./logs)
# - Optionally adds a host crontab entry for offsite backup sync
# - Brings the stack up
#
# Idempotent: safe to re-run.

set -euo pipefail

cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "ERROR: deploy/.env not found. Copy .env.example or use the Setup-Wizard." >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a; . ./.env; set +a

require_root() {
  if [ "$(id -u)" -ne 0 ]; then
    echo "Please run as root (sudo ./install.sh)" >&2
    exit 1
  fi
}

ensure_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "[install] docker not found, installing..."
    apt-get update
    apt-get install -y ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/debian/gpg \
      | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    . /etc/os-release
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/debian $VERSION_CODENAME stable" \
      > /etc/apt/sources.list.d/docker.list
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  fi
}

ensure_users() {
  # Log-Server system user (uid 1500 to match docker-compose)
  if ! id -u "${LOG_SRV_USER}" >/dev/null 2>&1; then
    echo "[install] creating system user ${LOG_SRV_USER} (uid 1500)"
    useradd -r -u 1500 -s /usr/sbin/nologin -d /var/empty "${LOG_SRV_USER}" || true
  fi

  # Note: DB_USER lives only inside the postgres container, no host user needed.
  # Dashboard login users are managed entirely in Authentik.
}

ensure_dirs() {
  mkdir -p ./certs ./logs ./authentik/blueprints "${BACKUP_PATH}"
  chown -R 1500:1500 ./logs || true
  chmod 700 ./certs
  echo "[install] cert dir is $(realpath ./certs) – place fullchain.pem + privkey.pem there"
}

ensure_host_cron() {
  # Optional: rsync backups to an offsite location. Only added if user uncomments.
  CRON_LINE="# 30 4 * * * rsync -a $(realpath "${BACKUP_PATH}")/ user@offsite:/backups/dashboard/"
  CRON_FILE=/etc/cron.d/dashboard-backup
  if [ ! -f "$CRON_FILE" ]; then
    echo "$CRON_LINE" > "$CRON_FILE"
    chmod 644 "$CRON_FILE"
    echo "[install] wrote $CRON_FILE (commented offsite-rsync template)"
  fi
}

bring_up() {
  chmod +x backup/backup.sh backup/entrypoint.sh
  echo "[install] building & starting stack..."
  docker compose pull
  docker compose build dashboard
  docker compose up -d
}

require_root
ensure_docker
ensure_users
ensure_dirs
ensure_host_cron
bring_up

cat <<EOF

──────────────────────────────────────────────────────────────
Stack is up.
  Dashboard : http://${HOSTNAME}/   (HTTPS once certs are in ${CERT_PATH})
  Authentik : http://${HOSTNAME}/auth/   (login: akadmin / ${AUTHENTIK_BOOTSTRAP_PASSWORD})

Next steps:
  1. Open Authentik, change the akadmin password.
  2. Copy the OIDC client-secret (Applications → Providers → dashboard-oidc)
     into deploy/.env as OIDC_CLIENT_SECRET=… and run:
         docker compose up -d authentik authentik-worker
  3. Configure Google / Microsoft / SAML sources – see deploy/README-SSO.md
──────────────────────────────────────────────────────────────
EOF
