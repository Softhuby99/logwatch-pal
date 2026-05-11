# 15 – Onboarding (neuer Admin)

Runbook für die ersten 30 Tage als Dashboard-Admin.

## Tag 1 – Zugänge & Lesen

- [ ] SSH-Zugang zu LogSrv (eigener User + sudo)
- [ ] SSH-Zugang zu LogServer-VM (read-only auf MariaDB)
- [ ] Authentik-Account in Gruppe `dashboard-users` + Admin-Rolle
- [ ] OPNsense-GUI-Zugang (read)
- [ ] Zugriff auf Offsite-Backup-Storage
- [ ] GitHub-Lesezugriff auf `Softhuby99/logwatch-pal`
- [ ] Passwort-Manager-Eintrag mit allen oben genannten Credentials
- [ ] Kompletten [docs/](./README.md)-Ordner einmal überfliegen
- [ ] [01 Architektur](./01-architecture.md) im Detail lesen

## Woche 1 – Verstehen

- [ ] Dashboard im Browser: jeden Tab/Drilldown öffnen
- [ ] `docker compose ps` + `logs` auf LogSrv ansehen
- [ ] Eine `.env`-Variable testweise ändern und Re-Deploy nachvollziehen
- [ ] Ein Backup manuell erzeugen und in einer Lab-VM restoren ([14 DR](./14-disaster-recovery.md))
- [ ] Authentik: einen Test-User anlegen, in Gruppe binden, Login testen

## Woche 2 – Mitarbeiten

- [ ] Issue im Repo erstellen oder Doku-PR einreichen
- [ ] Ein Update einspielen (`git pull` + `up -d`)
- [ ] Troubleshooting-Szenario nachstellen (z. B. nginx-Container stoppen → 502 erleben → fixen)

## Woche 3 – Verantworten

- [ ] On-Call-Schicht übernehmen
- [ ] Quartalsweisen Restore-Test mitlaufen lassen
- [ ] Security-Checklist [13](./13-security-checklist.md) vollständig abarbeiten

## Woche 4 – Eigenständig

- [ ] Eigene Verbesserung umsetzen (Doku, Skript, Monitoring)
- [ ] Wissensaustausch mit dem Team
- [ ] Zugang zur Eskalations-Telefonliste

## Wichtige Kontakte (anpassen!)

| Rolle | Person | Kontakt |
|-------|--------|---------|
| IT-Leitung | <Name> | <Mail/Tel> |
| Backup-Storage Provider | <Name> | <Support-URL> |
| DNS-Provider | <Name> | <Support> |
| Externer Dienstleister | <Name> | <24/7-Hotline> |

## Eskalationspfad

```
On-Call Admin (sofort)
   ↓ 30 min ohne Fortschritt
IT-Leitung
   ↓ 2 h
Externer Dienstleister
```

## Dokumentation pflegen

Jede Änderung an Konfig / Architektur **muss** in den passenden Doku-Kapiteln festgehalten werden – im selben Pull-Request wie der Code.
