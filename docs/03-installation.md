# 03 – Installation (Neuaufbau)

Schritt-für-Schritt Anleitung für eine **vollständige Neuinstallation** des Dashboards auf einer frischen Debian-VM.

> Voraussetzungen siehe [02 Voraussetzungen](./02-prerequisites.md).

## Schritt 1 – VM bereitstellen

- Debian 12 oder 13 (minimal install)
- Hostname: z. B. `logsrv`
- Statische IP, SSH-Key-Login
- Zeitzone + NTP eingerichtet

## Schritt 2 – Basis-Härtung

```bash
apt update && apt upgrade -y
apt install -y ufw fail2ban unattended-upgrades curl git jq rsync
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
systemctl enable --now fail2ban
dpkg-reconfigure -plow unattended-upgrades
```

## Schritt 3 – Docker installieren

```bash
apt-get install -y ca-certificates gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/debian $VERSION_CODENAME stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin
docker --version && docker compose version
```

## Schritt 4 – System-User

```bash
useradd -r -u 1001 -s /usr/sbin/nologin -d /var/empty logcollector || true
```

## Schritt 5 – Verzeichnisse

```bash
mkdir -p /opt/dashboard
chown root:root /opt/dashboard
```

## Schritt 6 – Repo klonen

```bash
git clone https://github.com/Softhuby99/logwatch-pal /opt/dashboard
cd /opt/dashboard
```

## Schritt 7 – `.env` anlegen

```bash
cp deploy/.env.example deploy/.env
chmod 600 deploy/.env
nano deploy/.env
```

Alle Variablen erklärt in [04 Configuration-Reference](./04-configuration-reference.md). **Mindestens** anpassen:

- `HOSTNAME=logdash.servuswir.de`
- `SERVER_IP=0.0.0.0`
- `DB_PASSWORD=<sicheres Passwort>`
- `MARIADB_HOST`, `MARIADB_USER`, `MARIADB_PASSWORD`, `MARIADB_DATABASE`
- `LOGDB_NETWORK=logserver_default`
- `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` (aus Authentik – siehe [06](./06-authentik-setup.md))
- alle `VITE_OIDC_*` (werden in das React-Bundle eingebaut!)
- `OPNSENSE_*`, `CROWDSEC_*`, `MAILCOW_*` je nach Bedarf
- `REMOTE_HOSTS` für SSH-Quellen

## Schritt 8 – Verzeichnisse für Logs/Backups/Certs

```bash
mkdir -p /opt/dashboard/deploy/{certs,backups,logs,authentik/blueprints}
chown -R 1001:1001 /opt/dashboard/deploy/logs
chmod 700 /opt/dashboard/deploy/certs
```

## Schritt 9 – TLS-Zertifikate ablegen

Erstellung siehe [05 Zertifikate](./05-certificates.md). Erwartete Dateien:

```
/opt/dashboard/deploy/certs/fullchain.pem
/opt/dashboard/deploy/certs/privkey.pem
```

## Schritt 10 – Externes Docker-Netz prüfen

```bash
docker network ls | grep logserver_default || \
  docker network create logserver_default
```

## Schritt 11 – Stack bauen + starten

```bash
cd /opt/dashboard
docker compose -f deploy/docker-compose.yml build dashboard api
docker compose -f deploy/docker-compose.yml up -d
docker compose -f deploy/docker-compose.yml ps
```

Erwartetes Ergebnis: alle Container `Up (healthy)`.

## Schritt 12 – Authentik konfigurieren

Folge [06 Authentik-Setup](./06-authentik-setup.md). Anschließend `OIDC_CLIENT_SECRET` in `.env` eintragen und das Dashboard neu bauen:

```bash
docker compose -f deploy/docker-compose.yml build --no-cache dashboard
docker compose -f deploy/docker-compose.yml up -d --force-recreate dashboard
```

## Schritt 13 – OPNsense-Rules

Folge [07 OPNsense-Setup](./07-opnsense-setup.md): NAT-Forwards für 80/443/9443, API-User für Dashboard, CrowdSec.

## Schritt 14 – SSH-Keys auf Remote-Hosts verteilen

```bash
docker compose -f deploy/docker-compose.yml exec api \
  cat /home/node/.ssh/id_ed25519_dashboard.pub
```

Public-Key auf jedem Remote-Host als `authorized_keys` für den `logreader`-User hinterlegen. Details: [08 SSH-Log-Abholung](./08-ssh-log-collection.md).

## Schritt 15 – Verifikation

```bash
# API direkt
curl -i http://127.0.0.1:3001/api/health

# Über Proxy
curl -ki -H "Host: logdash.servuswir.de" https://127.0.0.1/api/stats | head

# Auth-Discovery (von extern)
curl -s https://sso.servuswir.de:9443/application/o/log-dashboard/.well-known/openid-configuration | jq .
```

Anschließend im Browser `https://logdash.servuswir.de/` öffnen → Login via Authentik → Dashboard zeigt Daten.

## Schritt 16 – Backups verifizieren

```bash
docker compose -f deploy/docker-compose.yml logs backup --tail=20
ls -lh /opt/dashboard/deploy/backups/
```

Fertig. Weitere Schritte: [11 Betrieb](./11-operations.md).
