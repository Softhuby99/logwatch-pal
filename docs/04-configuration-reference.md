# 04 – Configuration-Reference

Vollständige Beschreibung aller Variablen in `deploy/.env` und der wichtigsten Config-Dateien.

> Datei: `/opt/dashboard/deploy/.env` – `chmod 600`, niemals committen.

## 4.1 Server-User

| Variable | Pflicht | Beispiel | Beschreibung | Rebuild? |
|----------|---------|----------|--------------|----------|
| `LOG_SRV_USER` | ja | `logcollector` | System-User auf dem Host für `./logs` | nein |
| `LOG_SRV_UID` | ja | `1001` | UID muss zur Datei-Ownership passen | nein |
| `LOG_SRV_GID` | ja | `1001` | GID dito | nein |

## 4.2 Dashboard-Datenbank (PostgreSQL, intern)

| Variable | Pflicht | Beispiel | Beschreibung | Rebuild? |
|----------|---------|----------|--------------|----------|
| `DB_USER` | ja | `dashboard` | PG-User + DB-Name | nein |
| `DB_PASSWORD` | ja | `<random 32 chars>` | PG-Passwort | nein |

## 4.3 MariaDB (Log-DB, extern)

| Variable | Pflicht | Beispiel | Beschreibung | Rebuild? |
|----------|---------|----------|--------------|----------|
| `MARIADB_HOST` | ja | `logserver-db` | Container-Name **oder** `host.docker.internal` |
| `MARIADB_PORT` | ja | `3306` | |
| `MARIADB_USER` | ja | `loguser` | Read-only User auf `logdb` |
| `MARIADB_PASSWORD` | ja | `***` | |
| `MARIADB_DATABASE` | ja | `logdb` | |
| `LOGDB_NETWORK` | ja | `logserver_default` | externes Docker-Netz, mit `docker network ls` prüfen |

## 4.4 Backup

| Variable | Beispiel | Beschreibung |
|----------|----------|--------------|
| `BACKUP_PATH` | `/opt/dashboard/deploy/backups` | Zielverzeichnis für Dumps |
| `BACKUP_CRON` | `0 3 * * *` | Cron-Schedule (täglich 03:00) |

## 4.5 Web / TLS

| Variable | Beispiel | Beschreibung |
|----------|----------|--------------|
| `SERVER_IP` | `0.0.0.0` | Bind-IP des bundled-Proxy |
| `HOSTNAME` | `logdash.servuswir.de` | FQDN, wird in nginx-Template + OIDC-Redirect verwendet |
| `ENABLE_HTTPS` | `true` | aktiviert TLS |
| `CERT_PATH` | `./certs` | relativ zu `deploy/`, Mount-Quelle für nginx |

## 4.6 Reverse-Proxy-Modus

| Variable | Beispiel | Beschreibung |
|----------|----------|--------------|
| `INSTALL_PROXY` | `true` | gebündelter nginx auf 80/443 |
| `INSTALL_AUTHENTIK` | `false` | Authentik läuft als separate VM |
| `DASHBOARD_BIND` | `127.0.0.1` | nur relevant bei `INSTALL_PROXY=false` |
| `DASHBOARD_PORT` | `8080` | dito |

## 4.7 Authentik-Anbindung (extern)

| Variable | Pflicht | Beispiel | Beschreibung |
|----------|---------|----------|--------------|
| `AUTHENTIK_URL` | ja | `https://sso.servuswir.de:9443` | Basis-URL der externen Instanz |
| `OIDC_CLIENT_ID` | ja | `dashboard` oder generierte ID | aus Authentik-Provider |
| `OIDC_CLIENT_SECRET` | bei Confidential-Client | `***` | bei Public+PKCE leer |

## 4.8 Frontend (Vite – build-time!)

⚠️ **Änderungen erfordern `docker compose build --no-cache dashboard`.**

| Variable | Beispiel | Beschreibung |
|----------|----------|--------------|
| `VITE_AUTH_REQUIRED` | `true` | Auth-Pflicht auf allen Routen |
| `VITE_OIDC_AUTHORITY` | `https://sso.servuswir.de:9443/application/o/log-dashboard/` | Discovery-URL Basis |
| `VITE_OIDC_CLIENT_ID` | `dashboard` | identisch mit `OIDC_CLIENT_ID` |
| `VITE_OIDC_REDIRECT_URI` | `https://logdash.servuswir.de/auth/callback` | exakt wie in Authentik |
| `VITE_OIDC_POST_LOGOUT_URI` | `https://logdash.servuswir.de/login` | |
| `VITE_SSO_GOOGLE_ENABLED` | `true` | Button anzeigen |
| `VITE_SSO_MICROSOFT_ENABLED` | `true` | |
| `VITE_SSO_SAML_ENABLED` | `true` | |
| `VITE_SSO_OIDC_ENABLED` | `true` | |
| `VITE_SSO_PASSWORD_ENABLED` | `true` | klassischer Login |

## 4.9 Remote-Integrationen

| Variable | Beispiel | Beschreibung |
|----------|----------|--------------|
| `REMOTE_HOSTS` | `logreader@mail.lan:22,logreader@web.lan:22` | komma-getrennt |
| `OPNSENSE_HOST` | `https://opnsense.lan` | Basis-URL |
| `OPNSENSE_API_KEY` | `***` | aus OPNsense User → API-Keys |
| `OPNSENSE_API_SECRET` | `***` | dito |
| `OPNSENSE_INSECURE_TLS` | `1` | bei Self-Signed-Cert |
| `MAILCOW_HOST` | `https://mailcow.lan` | |
| `MAILCOW_API_KEY` | `***` | aus Mailcow → System → API |
| `MAILCOW_INSECURE_TLS` | `1` | |
| `CROWDSEC_LAPI_URL` | `http://opnsense.lan:8081` | LAPI des CrowdSec-Plugins |
| `CROWDSEC_BOUNCER_KEY` | `***` | aus CrowdSec → Bouncers |

## 4.10 Beispiel `.env` (vollständig, Platzhalter)

```dotenv
LOG_SRV_USER=logcollector
LOG_SRV_UID=1001
LOG_SRV_GID=1001

DB_USER=dashboard
DB_PASSWORD=<RANDOM_32>

MARIADB_HOST=logserver-db
MARIADB_PORT=3306
MARIADB_USER=loguser
MARIADB_PASSWORD=<MARIADB_PW>
MARIADB_DATABASE=logdb
LOGDB_NETWORK=logserver_default

BACKUP_PATH=/opt/dashboard/deploy/backups
BACKUP_CRON=0 3 * * *

SERVER_IP=0.0.0.0
HOSTNAME=logdash.servuswir.de
ENABLE_HTTPS=true
CERT_PATH=./certs

INSTALL_PROXY=true
INSTALL_AUTHENTIK=false

AUTHENTIK_URL=https://sso.servuswir.de:9443
OIDC_CLIENT_ID=<aus_Authentik>
OIDC_CLIENT_SECRET=

VITE_AUTH_REQUIRED=true
VITE_OIDC_AUTHORITY=https://sso.servuswir.de:9443/application/o/log-dashboard/
VITE_OIDC_CLIENT_ID=<aus_Authentik>
VITE_OIDC_REDIRECT_URI=https://logdash.servuswir.de/auth/callback
VITE_OIDC_POST_LOGOUT_URI=https://logdash.servuswir.de/login
VITE_SSO_GOOGLE_ENABLED=true
VITE_SSO_MICROSOFT_ENABLED=true
VITE_SSO_SAML_ENABLED=false
VITE_SSO_OIDC_ENABLED=true
VITE_SSO_PASSWORD_ENABLED=true

REMOTE_HOSTS=logreader@mail.lan:22
OPNSENSE_HOST=https://opnsense.lan
OPNSENSE_API_KEY=<KEY>
OPNSENSE_API_SECRET=<SECRET>
OPNSENSE_INSECURE_TLS=1
MAILCOW_HOST=https://mailcow.lan
MAILCOW_API_KEY=<KEY>
MAILCOW_INSECURE_TLS=1
CROWDSEC_LAPI_URL=http://opnsense.lan:8081
CROWDSEC_BOUNCER_KEY=<KEY>
```

## 4.11 Weitere relevante Config-Dateien

| Datei | Zweck | Änderung erfordert |
|-------|-------|--------------------|
| `deploy/docker-compose.yml` | Container-Definition | `compose up -d` |
| `deploy/nginx/templates/default.conf.template` | Reverse-Proxy (proxy-Container) | `up -d --force-recreate proxy` |
| `deploy/nginx/dashboard.conf` | SPA-Container nginx | `build --no-cache dashboard` |
| `deploy/Dockerfile.dashboard` | Build des SPA-Images | `build --no-cache dashboard` |
| `deploy/api/server.js` | Express-API | `build --no-cache api` |
| `deploy/authentik/blueprints/dashboard-oidc.yaml` | nur bei `INSTALL_AUTHENTIK=true` relevant | – |
