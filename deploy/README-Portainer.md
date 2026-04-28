# Deployment via Portainer

Diese Anleitung beschreibt, wie du den Dashboard-Stack komplett über
**Portainer** verwaltest – ohne CLI, mit automatischen Updates aus GitHub.

---

## Voraussetzungen

- Portainer CE läuft auf dem LogSrv (Docker)
- Du erreichst Portainer im Browser über **HTTPS**: `https://logsrv:9443`
  (HTTP-only ist deaktiviert – Portainer redirected/verweigert Port 9000)
- Edge-Agent-Tunnel auf **8000/tcp**
- Das Repo `Softhuby99/logwatch-pal` ist auf GitHub verfügbar

---

## ✅ Belegte Ports auf dem LogSrv

| Port | Dienst | Quelle |
|------|--------|--------|
| 9443/tcp | Portainer UI (HTTPS) | Portainer-Container |
| 8000/tcp | Portainer Edge Agent | Portainer-Container |
| 8080/tcp | Dashboard (Default) | dieser Stack, `DASHBOARD_PORT` |
| 80, 443/tcp | Bundled Proxy (nur falls `INSTALL_PROXY=true`) | dieser Stack |
| 9000/tcp | Authentik (nur falls `INSTALL_AUTHENTIK=true`) | dieser Stack |

➡️ **Kein Konflikt** zwischen Portainer (9443/8000) und dem Dashboard-Stack
(8080 + optional 80/443/9000). Du kannst die Defaults so lassen.

Wenn du den Default-Port des Dashboards ändern willst (z. B. weil 8080 schon
anderweitig belegt ist), setze in der `.env`:

```
DASHBOARD_PORT=8081
```

---

## Variante A: Stack aus GitHub-Repo (empfohlen)

Vorteil: „Pull and redeploy"-Button holt neue Commits automatisch.

1. Portainer → **Stacks → Add stack**
2. Name: `dashboard`
3. **Build method: Repository**
   - Repository URL: `https://github.com/Softhuby99/logwatch-pal`
   - Reference: `refs/heads/main`
   - Compose path: `deploy/docker-compose.yml`
4. **Environment variables** – manuell eintragen oder per *Load variables from .env file* hochladen.
   Mindestens setzen:
   ```
   COMPOSE_PROFILES=
   DB_USER=dashboard
   DB_PASSWORD=<sicheres-passwort>
   ADMIN_EMAIL=admin@deine-domain.tld
   BACKUP_PATH=/opt/dashboard/backups
   BACKUP_CRON=0 3 * * *

   INSTALL_PROXY=false
   INSTALL_AUTHENTIK=false
   DASHBOARD_BIND=0.0.0.0
   DASHBOARD_PORT=8080

   HOSTNAME=dashboard.deine-domain.tld
   AUTHENTIK_URL=https://authentik.deine-domain.tld
   OIDC_CLIENT_ID=dashboard
   OIDC_CLIENT_SECRET=<aus-authentik>

   VITE_AUTH_REQUIRED=true
   VITE_OIDC_AUTHORITY=https://authentik.deine-domain.tld/application/o/dashboard/
   VITE_OIDC_CLIENT_ID=dashboard
   VITE_OIDC_REDIRECT_URI=https://dashboard.deine-domain.tld/auth/callback
   VITE_OIDC_POST_LOGOUT_URI=https://dashboard.deine-domain.tld/login
   VITE_SSO_GOOGLE_ENABLED=true
   VITE_SSO_MICROSOFT_ENABLED=true
   VITE_SSO_SAML_ENABLED=true
   VITE_SSO_OIDC_ENABLED=true
   VITE_SSO_PASSWORD_ENABLED=true

   AUTHENTIK_SECRET_KEY=unused-when-external
   AUTHENTIK_BOOTSTRAP_PASSWORD=unused
   AUTHENTIK_BOOTSTRAP_TOKEN=unused
   AUTHENTIK_DB_PASSWORD=unused
   ```
5. **`COMPOSE_PROFILES`** je nach Modus:
   | Modus | Wert |
   |-------|------|
   | Externer Proxy + externes Authentik (dein Setup) | *(leer lassen)* |
   | Bundle Authentik | `authentik` |
   | Bundle Proxy | `proxy` |
   | All-in-one | `authentik,proxy` |
6. **Deploy the stack** klicken.

### Updates einspielen
Stack öffnen → **Pull and redeploy**. Portainer holt den neuesten Commit
und startet veränderte Container neu.

> **Hinweis zum Build:** Das Dashboard-Image wird aus dem Dockerfile gebaut
> (`build:` in der compose). Beim ersten Deploy dauert das 2–4 Minuten.

---

## Variante B: Stack per Upload

Wenn du das Repo nicht mit GitHub verbinden willst:

1. Lokal `git clone` und `cd logwatch-pal`
2. Portainer → **Stacks → Add stack → Web editor**
3. Inhalt von `deploy/docker-compose.yml` einfügen
4. Wichtig: Der `build:`-Context (`context: ..`) funktioniert nur, wenn
   Portainer Zugriff auf den Quellcode hat. **Variante A ist daher einfacher.**
   Alternativ: Image vorab per CLI bauen (`docker build -f deploy/Dockerfile.dashboard -t dashboard:local .`)
   und in der compose `build:` durch `image: dashboard:local` ersetzen.

---

## Vorbereitung auf dem Host (einmalig)

Auch mit Portainer brauchst du ein paar Host-Vorbereitungen, die `install.sh`
sonst übernimmt:

```bash
# als root auf dem LogSrv
# Vorhandenen User wiederverwenden (z. B. logcollector, uid 1001) – oder neu anlegen:
sudo id logcollector || sudo useradd -r -u 1001 -s /usr/sbin/nologin -d /var/empty logcollector
sudo mkdir -p /opt/dashboard/{logs,backups,authentik/blueprints}
sudo chown -R 1001:1001 /opt/dashboard/logs
```

> Passe `LOG_SRV_USER`, `LOG_SRV_UID`, `LOG_SRV_GID` in der `.env` an, falls
> dein User eine andere UID/GID hat.

Wenn du **Bind-Mounts** statt der relativen Pfade willst, passe in der
compose-Datei die Volumes an (`./logs` → `/opt/dashboard/logs` usw.) –
oder lass die Defaults und Portainer legt sie im Stack-Workdir an
(`/data/compose/<stack-id>/`).

---

## Container überwachen

- **Logs**: Container öffnen → *Logs* (Live-Tail)
- **Console**: *Console → /bin/sh* für Debugging
- **Stats**: CPU/RAM pro Container
- **Restart-Policy**: bereits `unless-stopped` in der compose

---

## Backup-Hinweis

Der `backup`-Service schreibt nach `${BACKUP_PATH}` (Default `./backups`).
In Portainer-Stacks liegt das unter `/var/lib/docker/volumes/...` oder im
Stack-Workdir. Setze `BACKUP_PATH=/opt/dashboard/backups`, damit du die
Dumps an einem festen Pfad findest und per `rsync` offsite sichern kannst.
