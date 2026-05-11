## Projekt-Dokumentation: LogWatch Dashboard (final)

Ich erstelle eine vollständige Betriebs- und Installations-Doku als Markdown im Repo unter `docs/`. Die **Gesamtarchitektur** (von dir geliefert) wird vollständig in Kapitel 01 übernommen — sowohl als ASCII-Diagramm (1:1 wie geliefert) als auch erweitert um die Infrastruktur-Ebene (VMs, Container, Auth-Flow) als Mermaid-Diagramm.

### Dokumenten-Struktur

```
docs/
├── README.md                    # Einstieg + Inhaltsverzeichnis
├── 01-architecture.md           # Gesamt-Architektur (ASCII + Mermaid + PNG)
├── 02-prerequisites.md          # HW, SW, Netz, DNS, Accounts
├── 03-installation.md           # Schritt-für-Schritt Neuinstallation
├── 04-configuration-reference.md# JEDE .env-Variable + Beispiele
├── 05-certificates.md           # TLS via OPNsense ACME (Erstellung + Verteilung)
├── 06-authentik-setup.md        # Provider, Application, Scopes, SSO-Sources
├── 07-opnsense-setup.md         # Firewall-Rules, NAT, ACME, API-User, CrowdSec
├── 08-ssh-log-collection.md     # SSH-Keys, sudoers, Pfade pro Quelle
├── 09-logcollector-pipeline.md  # Parser → Normalizer → Enricher → Risk-Scorer
├── 10-database-schema.md        # MariaDB-Tabellen (security_events, auth_events, …)
├── 11-operations.md             # Update, Backup/Restore, Logs, Healthchecks
├── 12-troubleshooting.md        # Symptom → Ursache → Fix
├── 13-security-checklist.md     # Härtung, Secrets, MFA, DSGVO
├── 14-disaster-recovery.md      # Wiederherstellung in < 60 min
├── 15-onboarding.md             # Runbook für neue Admins
└── assets/
    ├── architecture-data.mmd    # Daten-Pipeline (deine ASCII-Vorlage als Mermaid)
    ├── architecture-infra.mmd   # VM-/Container-/Netz-Sicht
    ├── auth-flow.mmd            # OIDC-Sequenz (Browser ↔ nginx ↔ Authentik)
    └── *.png                    # gerenderte Versionen für Offline-Lesen
```

---

### Kapitel 01 – Gesamtarchitektur (Inhalt)

**1.1 Datenfluss-Sicht (deine Vorlage, 1:1 übernommen)**

```text
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  Mailcow    │   │  OPNsense   │   │  Fail2ban   │
│ Postfix/    │   │  + CrowdSec │   │  Jails      │
│ Dovecot/    │   │             │   │             │
│ nginx       │   │             │   │             │
└──────┬──────┘   └──────┬──────┘   └──────┬──────┘
       │ syslog/         │ API/log         │ logs
       ▼                 ▼                 ▼
      ┌───────────────────────────────────────┐
      │   LogCollector (Python)               │
      │   - Parser (pro Quelle)               │
      │   - Normalizer                        │
      │   - Enricher (GeoIP/ASN)              │
      │   - Risk-Scorer                       │
      └──────────────┬────────────────────────┘
                     ▼
            ┌─────────────────┐
            │  MariaDB logdb  │
            │  - security_events
            │  - auth_events
            │  - ip_summary
            │  - ip_enrichment
            │  - ip_risk_score│
            └────────┬────────┘
                     ▼
            ┌─────────────────┐
            │  Dashboard API  │
            │  (Express)      │
            └────────┬────────┘
                     ▼
            ┌─────────────────┐
            │  React UI       │
            │  (Dashboard)    │
            └─────────────────┘
```

> Der LogCollector schreibt normalisierte Events nach MariaDB. Periodische Jobs (IP-Enricher, Risk-Score, IP-Summary) lassen sich unter **Tools** im Dashboard manuell anstoßen. Das Dashboard liest **ausschließlich** über die Express-API — keine Direktverbindung zur Datenbank.

**1.2 Infrastruktur-Sicht (Mermaid → PNG)** — ergänzt die Datenflusssicht um die physische Ebene:
- VMs: `OPNsense` (Firewall + ACME) | `Authentik-VM` (`sso.servuswir.de:9443`) | `LogServer-VM` (MariaDB `logdb` + LogCollector-Python) | `LogSrv` (Docker-Host für Dashboard) | `Mailcow-VM`
- Container auf LogSrv: `proxy` (nginx 80/443, TLS-Termination) → `dashboard` (nginx + React-SPA) + `api` (Express, Port 3001) + `db` (PostgreSQL für Dashboard-Eigendaten) + `backup`
- Docker-Netz `logserver_default`: brückt `api`-Container zu `logserver-db` (MariaDB)
- Pfeile mit Protokoll/Port-Beschriftung

**1.3 Auth-Flow-Sequenz (Mermaid → PNG)**:
Browser → `https://logdash.servuswir.de` → SPA → `/auth/authorize` (Redirect) → `sso.servuswir.de:9443/application/o/log-dashboard/` → Login → Callback `/auth/callback` mit Code → PKCE-Token-Exchange → API-Calls mit Bearer-Token

**1.4 Verantwortlichkeiten pro Komponente** (Tabelle: Komponente | Zweck | Schreibt nach | Liest von | Betreiber-VM)

**1.5 Trennung der Belange**
- **LogCollector** (separate VM/Repo): Ingestion + Normalisierung + Enrichment
- **Dashboard** (dieses Repo): nur Visualisierung + manuelles Triggern von Jobs
- **Authentik** (separate VM): SSO/OIDC, kein direkter App-Zugriff auf User-DB
- **OPNsense**: Netzwerk-Edge + CrowdSec-Quelle, eigener API-Zugang für Read-Only

**1.6 Daten-Quellen-Tabelle**: Quelle | Transport | Format | Frequenz | Ziel-Tabelle
- Mailcow → syslog → raw → kontinuierlich → `auth_events` / `security_events`
- OPNsense + CrowdSec → API + log → JSON → 60s Polling → `security_events`
- Fail2ban → SSH `tail` → text → 30s → `auth_events`

---

### Kapitel 09 – LogCollector-Pipeline (neu, ergänzend)

Damit die Architektur vollständig ist, beschreibt dieses Kapitel die Pipeline (auch wenn der Code in einem separaten Repo liegt):
- **Parser**: ein Modul pro Quelle (mailcow/opnsense/fail2ban/crowdsec)
- **Normalizer**: einheitliches Event-Schema (timestamp, source, type, src_ip, dst_ip, user, action, severity)
- **Enricher**: GeoIP (MaxMind), ASN, Reverse-DNS — Cache in `ip_enrichment`
- **Risk-Scorer**: Heuristik (Anzahl Fails, GeoIP-Country, ASN-Reputation, CrowdSec-Match) → `ip_risk_score`
- **Trigger via Dashboard-Tools**: API-Endpoints `/api/tools/run-enricher`, `/api/tools/recompute-risk`, `/api/tools/rebuild-summary`

### Kapitel 10 – Datenbank-Schema

Dokumentiert die MariaDB-Tabellen mit Spalten/Indizes/Beispiel-Rows:
- `security_events`, `auth_events`, `ip_summary`, `ip_enrichment`, `ip_risk_score`
- ER-Diagramm (Mermaid)
- Retention-Strategie (Partitionierung nach Monat empfohlen)

---

### Restliche Kapitel (Kurzfassung — Details wie zuvor besprochen)

- **02 Voraussetzungen**: VM-Specs, Debian 12/13, Docker ≥24, DNS-Records, Public-IP, Accounts
- **03 Installation**: 14 nummerierte Schritte, copy-paste-fähig
- **04 Configuration-Reference**: jede `.env`-Variable in Tabellenform + komplettes Beispiel; Hinweis welche Vite-Vars Rebuild erfordern
- **05 Zertifikate**: OPNsense `os-acme-client` Schritt-für-Schritt (Account, HTTP-01/DNS-01, Auto-Renew, Export per scp nach `/opt/dashboard/deploy/certs/`, nginx-Reload-Hook); Variante manuell `certbot`; Variante eigene CA
- **06 Authentik**: Provider OIDC (PKCE), Application `log-dashboard`, Scopes, Federation (Google/MS/SAML), MFA, Discovery-URL-Verifikation
- **07 OPNsense**: NAT (80/443→LogSrv, 9443→Authentik), Aliases, Floating-Rules, API-User für Dashboard mit minimalen Privileges, CrowdSec-LAPI + Bouncer-Key, Remote-Syslog
- **08 SSH-Log-Abholung**: Public-Key auslesen, `logreader`-User auf Remotes, restricted `authorized_keys`, sudoers, `REMOTE_HOSTS`-Format, Key-Rotation
- **11 Betrieb**: Update-Befehle, Backup (PG-Dump + logs + .env-encrypted + certs), Restore, Healthchecks, Monitoring-Empfehlung (Uptime-Kuma)
- **12 Troubleshooting**: 404 `/api/*`, 502, OIDC-Loop, MariaDB-Netz, TLS-Cert, leere SSH-Logs — jeweils Diagnose + Fix
- **13 Security**: `.env` chmod 600, TLS+HSTS, Authentik-MFA, CrowdSec, verschlüsselte Offsite-Backups, DSGVO-Auflistung, Audit-Trail
- **14 Disaster-Recovery**: RTO < 60 min Runbook
- **15 Onboarding**: Tag-1/Woche-1 Checkliste für neue Admins

### Sprache & Format
- Deutsch, Markdown, Mermaid-Diagramme + PNG-Export für Offline
- Tabellen für Variablen/Ports/Rechte
- Copy-paste-fähige Code-Blöcke
- Querverweise zwischen Kapiteln

---

**Fertig zum Implementieren.** Klicke „Implement plan" und ich lege alle 16 Dateien + Diagramme an. Wenn du noch etwas ergänzen willst (z. B. eigenes Kapitel zur LogCollector-VM-Installation, Mailcow-Syslog-Setup, oder ein API-Endpoint-Verzeichnis), sag kurz Bescheid.