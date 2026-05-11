# LogWatch Dashboard – Dokumentation

Vollständige Betriebs- und Installations-Dokumentation für das LogWatch Dashboard.

## Inhaltsverzeichnis

| # | Kapitel | Inhalt |
|---|---------|--------|
| 01 | [Architektur](./01-architecture.md) | Gesamtarchitektur, Daten- und Auth-Flow |
| 02 | [Voraussetzungen](./02-prerequisites.md) | HW, SW, DNS, Accounts |
| 03 | [Installation](./03-installation.md) | Schritt-für-Schritt Neuinstallation |
| 04 | [Configuration-Reference](./04-configuration-reference.md) | Jede `.env`-Variable erklärt |
| 05 | [Zertifikate](./05-certificates.md) | TLS via OPNsense ACME |
| 06 | [Authentik-Setup](./06-authentik-setup.md) | OIDC Provider + Application |
| 07 | [OPNsense-Setup](./07-opnsense-setup.md) | Firewall, NAT, API, CrowdSec |
| 08 | [SSH-Log-Abholung](./08-ssh-log-collection.md) | Keys, sudoers, Pfade |
| 09 | [LogCollector-Pipeline](./09-logcollector-pipeline.md) | Parser → Risk-Scorer |
| 10 | [Datenbank-Schema](./10-database-schema.md) | MariaDB-Tabellen |
| 11 | [Betrieb](./11-operations.md) | Update, Backup, Logs |
| 12 | [Troubleshooting](./12-troubleshooting.md) | Symptom → Fix |
| 13 | [Security-Checklist](./13-security-checklist.md) | Härtung, DSGVO |
| 14 | [Disaster-Recovery](./14-disaster-recovery.md) | Wiederherstellung |
| 15 | [Onboarding](./15-onboarding.md) | Runbook für neue Admins |

## Schnell-Links

- **Neuinstallation?** → [02 Voraussetzungen](./02-prerequisites.md) → [03 Installation](./03-installation.md)
- **Etwas kaputt?** → [12 Troubleshooting](./12-troubleshooting.md)
- **Update?** → [11 Betrieb](./11-operations.md#update)
- **Neuer Admin?** → [15 Onboarding](./15-onboarding.md)

## Konventionen

- Alle Pfade auf dem Docker-Host beziehen sich auf `/opt/dashboard/`.
- Befehle als `root` ausführen, sofern nicht anders angegeben.
- Platzhalter wie `<DEINE-DOMAIN>` müssen ersetzt werden.
- Diagramm-Quellen liegen unter [`assets/`](./assets/) als Mermaid (`.mmd`).
