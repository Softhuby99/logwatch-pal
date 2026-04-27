# Dashboard – Self-Hosted Deployment

Komplettes Docker-Setup für Debian 12/13 oder Windows (Docker Desktop) mit:

- **dashboard** – die React-App (gebaut, ausgeliefert über nginx)
- **db** – PostgreSQL für Dashboard-Daten
- **logsrv** – Platzhalter-Service für deinen Log-Collector (eigenes Image eintragen)
- **authentik** – Identity Provider (server + worker + redis + dedizierte DB)
- **proxy** – nginx-Reverse-Proxy (HTTP **und** HTTPS, eigene Zertifikate)
- **backup** – Cron-Container für tägliche DB-Dumps und Log-Snapshots

## Schnellstart (Debian 12 / 13)

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin
cd deploy
cp .env.example .env       # oder die im Wizard erzeugte .env hierher kopieren
sudo ./install.sh
```

Auf Windows: Docker Desktop installieren, in PowerShell `cd deploy; docker compose up -d`.

## Verzeichnisse

| Pfad | Zweck |
|------|-------|
| `./certs/` | Lege hier deine Let's-Encrypt Zertifikate `fullchain.pem` + `privkey.pem` ab |
| `./backups/` | Wird vom backup-Container befüllt (DB-Dumps + Log-Tarballs) |
| `./logs/` | Wird vom logsrv gemountet |
| `./authentik/blueprints/` | YAML-Blueprints, die Authentik beim Start importiert |

## SSO

Siehe [`README-SSO.md`](./README-SSO.md) für die Schritt-für-Schritt-Konfiguration
von Google, Microsoft (Entra ID), SAML und generischem OIDC in Authentik.

## Backup wiederherstellen

```bash
docker compose exec -T db psql -U $DB_USER $DB_USER < backups/dashboard-YYYY-MM-DD.sql
```
