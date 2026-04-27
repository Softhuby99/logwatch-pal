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

# ----------------------------------------------------------------------------
# Interactive: confirm / change the server bind IP and hostname.
# Detects the primary IPv4 of the host and offers it as the default. The
# selected value is written back to .env as SERVER_IP and consumed by
# docker-compose (proxy port binding) and the final summary.
# Skip with NONINTERACTIVE=1 ./install.sh
# ----------------------------------------------------------------------------
prompt_server_ip() {
  local detected default chosen new_host current_host
  detected=$(ip -4 -o addr show scope global 2>/dev/null \
              | awk '{print $4}' | cut -d/ -f1 | head -n1 || true)
  default="${SERVER_IP:-${detected:-0.0.0.0}}"
  current_host="${HOSTNAME:-dashboard.local}"

  if [ -t 0 ] && [ "${NONINTERACTIVE:-0}" != "1" ]; then
    echo
    echo "Detected IPv4 addresses on this host:"
    ip -4 -o addr show scope global 2>/dev/null \
      | awk '{printf "  - %s  (%s)\n", $4, $2}' || echo "  (none detected)"
    echo
    read -r -p "Bind the dashboard to which IP? [${default}]  (0.0.0.0 = all interfaces) " chosen
    chosen="${chosen:-$default}"
    read -r -p "Hostname / FQDN for HTTPS + OIDC redirect [${current_host}] " new_host
    new_host="${new_host:-$current_host}"
  else
    chosen="$default"
    new_host="$current_host"
  fi

  SERVER_IP="$chosen"
  HOSTNAME="$new_host"
  export SERVER_IP HOSTNAME

  # Persist into .env (replace if present, append otherwise)
  if grep -q '^SERVER_IP=' .env; then
    sed -i "s|^SERVER_IP=.*|SERVER_IP=${SERVER_IP}|" .env
  else
    echo "SERVER_IP=${SERVER_IP}" >> .env
  fi
  if grep -q '^HOSTNAME=' .env; then
    sed -i "s|^HOSTNAME=.*|HOSTNAME=${HOSTNAME}|" .env
  else
    echo "HOSTNAME=${HOSTNAME}" >> .env
  fi
  echo "[install] server bind: ${SERVER_IP}   hostname: ${HOSTNAME}"
}

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
prompt_server_ip
ensure_users
ensure_dirs
ensure_host_cron
bring_up

cat <<EOF

──────────────────────────────────────────────────────────────
Stack is up.
  Bound to  : ${SERVER_IP}:80  /  ${SERVER_IP}:443
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
