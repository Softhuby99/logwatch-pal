# 11 – Betrieb

## 11.1 Update <a id="update"></a>

```bash
cd /opt/dashboard
git pull
docker compose -f deploy/docker-compose.yml build --no-cache dashboard api
docker compose -f deploy/docker-compose.yml up -d --force-recreate
docker compose -f deploy/docker-compose.yml ps
```

### Selektive Updates

| Änderung in | Befehl |
|-------------|--------|
| `deploy/nginx/templates/*` | `up -d --force-recreate proxy` |
| `deploy/api/*` | `build --no-cache api && up -d --force-recreate api` |
| `src/**` (Frontend) | `build --no-cache dashboard && up -d --force-recreate dashboard` |
| `.env` (Vite-Vars) | wie Frontend |
| `.env` (Runtime-Vars) | `up -d --force-recreate <service>` |

## 11.2 Backup

Automatisch via `backup`-Container nach `${BACKUP_PATH}` (Default `/opt/dashboard/deploy/backups`).

Manueller Dump:

```bash
docker compose -f deploy/docker-compose.yml exec -T db \
  pg_dump -U $DB_USER $DB_USER > /opt/dashboard/deploy/backups/dashboard-$(date +%F).sql
```

**Was sichern (offsite):**

| Pfad | Inhalt | Sensibel? |
|------|--------|-----------|
| `deploy/backups/*.sql` | PG-Dumps | mittel |
| `deploy/.env` | Secrets | **hoch** – verschlüsseln! |
| `deploy/certs/` | TLS-Cert + Key | hoch |
| `deploy/logs/` | Log-Snapshots | mittel |

Beispiel verschlüsseltes Offsite-Backup:

```bash
tar czf - /opt/dashboard/deploy/{backups,.env,certs} \
  | gpg -c --cipher-algo AES256 -o /tmp/dashboard-$(date +%F).tar.gz.gpg
rsync -a /tmp/dashboard-$(date +%F).tar.gz.gpg user@offsite:/backups/
```

## 11.3 Restore

```bash
cd /opt/dashboard
docker compose -f deploy/docker-compose.yml exec -T db \
  psql -U $DB_USER $DB_USER < deploy/backups/dashboard-2026-05-11.sql
```

## 11.4 Logs

```bash
# Live alle Container
docker compose -f deploy/docker-compose.yml logs -f --tail=100

# Einzelner Service
docker compose -f deploy/docker-compose.yml logs -f --tail=100 proxy
docker compose -f deploy/docker-compose.yml logs -f --tail=100 api
```

## 11.5 Healthchecks

```bash
# API direkt
curl -i http://127.0.0.1:3001/api/health

# Über Proxy
curl -ki -H "Host: logdash.servuswir.de" https://127.0.0.1/api/stats | head

# Container-Status
docker compose -f deploy/docker-compose.yml ps
```

## 11.6 Monitoring (empfohlen)

- **Uptime-Kuma** auf separatem Host:
  - HTTPS-Check `https://logdash.servuswir.de/api/health` alle 60 s
  - TLS-Cert-Ablauf < 14 Tage
  - Authentik-Discovery `https://sso.servuswir.de:9443/-/health/live/`
- **Disk-Alert** auf LogSrv (PostgreSQL-Volume + `backups/`)

## 11.7 Routinearbeiten

| Intervall | Aufgabe |
|-----------|---------|
| täglich | Backup-Status prüfen |
| wöchentlich | `docker image prune -f` |
| monatlich | Update einspielen |
| quartalsweise | Restore-Test in Lab-VM |
| jährlich | SSH-Key-Rotation (Kap. 08) |
