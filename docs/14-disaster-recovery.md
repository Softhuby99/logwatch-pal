# 14 – Disaster-Recovery

**Ziel:** Wiederherstellung des Dashboards in **< 60 min** bei Totalausfall der LogSrv-VM.

> Voraussetzung: Aktuelles Offsite-Backup (siehe [11 Betrieb](./11-operations.md#112-backup)).

## 14.1 Annahmen

- LogSrv-VM ist verloren / korrupt
- Authentik-VM, OPNsense, LogServer-VM (MariaDB) laufen weiter
- Letztes Backup von gestern Nacht existiert (RPO: 24 h)

## 14.2 Schritt-für-Schritt (RTO < 60 min)

### Schritt 1 – Neue VM (5 min)

Identische Specs wie alt (siehe [02 Voraussetzungen](./02-prerequisites.md)). Hostname `logsrv`, gleiche LAN-IP wenn möglich (sonst NAT in OPNsense anpassen).

### Schritt 2 – Basis + Docker (10 min)

```bash
# siehe 03-installation.md Schritte 2 + 3
apt update && apt upgrade -y
apt install -y ufw fail2ban curl git
# … Docker installieren
```

### Schritt 3 – Backup zurückholen (5 min)

```bash
mkdir -p /opt/dashboard
cd /opt/dashboard
rsync -a user@offsite:/backups/dashboard-LATEST.tar.gz.gpg /tmp/
gpg -d /tmp/dashboard-LATEST.tar.gz.gpg | tar xzf - -C /
# entpackt deploy/{backups,.env,certs} an Originalort
```

### Schritt 4 – Repo klonen (2 min)

```bash
git clone https://github.com/Softhuby99/logwatch-pal /tmp/repo
# nur Code übernehmen, .env/certs/backups bleiben aus dem Restore
rsync -a --exclude=deploy/.env --exclude=deploy/certs --exclude=deploy/backups \
  /tmp/repo/ /opt/dashboard/
```

### Schritt 5 – Docker-Netz (1 min)

```bash
docker network create logserver_default || true
```

### Schritt 6 – Stack starten (10 min, Build inkludiert)

```bash
cd /opt/dashboard
docker compose -f deploy/docker-compose.yml up -d --build
docker compose -f deploy/docker-compose.yml ps
```

### Schritt 7 – DB restoren (5 min)

```bash
docker compose -f deploy/docker-compose.yml exec -T db \
  psql -U $DB_USER $DB_USER < deploy/backups/dashboard-LATEST.sql
```

### Schritt 8 – DNS / NAT prüfen (5 min)

- Falls neue IP: A-Record `logdash.servuswir.de` aktualisieren
- OPNsense NAT auf neue LogSrv-IP umschwenken
- TLS-Cert ist im Restore enthalten – kein Re-Issue nötig

### Schritt 9 – Verifikation (5 min)

```bash
curl -ki -H "Host: logdash.servuswir.de" https://127.0.0.1/api/stats | head
```

Browser-Login → Dashboard zeigt Daten? ✅

### Schritt 10 – ACME-Deploy-Job neu hinterlegen (10 min, optional)

`acme-deploy`-User wieder anlegen + Public-Key der OPNsense-Automation hinterlegen (siehe [05 Zertifikate](./05-certificates.md#a5-auto-verteilung-auf-logsrv)).

## 14.3 Recovery-Matrix

| Komponente betroffen | Action |
|----------------------|--------|
| nur `proxy` Container | `docker compose up -d --force-recreate proxy` |
| nur `api` Container | `build --no-cache api && up -d --force-recreate api` |
| LogSrv komplett | dieses Runbook |
| MariaDB / LogServer-VM | separates Runbook (LogCollector-Repo) |
| Authentik-VM | aus Authentik-Backup restoren – Dashboard-Login bis dahin offline |
| OPNsense | Konfig-Backup aus OPNsense → neue Box |

## 14.4 Test

- **Quartalsweiser Restore-Test in einer Lab-VM:**
  - frische VM
  - Backup einspielen (anonyme Kopie)
  - Stack starten ohne externe Abhängigkeiten
  - Ergebnis dokumentieren

## 14.5 Eskalation

| Stufe | Wer | Wann |
|-------|-----|------|
| 1 | On-Call Admin | sofort |
| 2 | IT-Leitung | nach 30 min ohne Lösung |
| 3 | externer Dienstleister | nach 2 h |
