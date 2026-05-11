# 09 – LogCollector-Pipeline

> Der LogCollector ist eine **separate Python-Anwendung** auf der LogServer-VM (eigenes Repo). Dieses Kapitel beschreibt die Pipeline aus Dashboard-Sicht.

## 9.1 Stages

```text
Quellen → Parser → Normalizer → Enricher → Risk-Scorer → MariaDB
```

| Stage | Aufgabe | Output |
|-------|---------|--------|
| **Parser** | je ein Modul pro Quelle (mailcow, opnsense, fail2ban, crowdsec) | strukturiertes Dict |
| **Normalizer** | einheitliches Event-Schema | normalisiertes Event |
| **Enricher** | GeoIP (MaxMind), ASN, Reverse-DNS | + IP-Metadaten |
| **Risk-Scorer** | Heuristik | Score 0–100 pro IP |

## 9.2 Einheitliches Event-Schema

```json
{
  "timestamp": "2026-05-11T10:23:45Z",
  "source": "mailcow|opnsense|fail2ban|crowdsec",
  "type": "auth_failure|auth_success|ban|alert|...",
  "src_ip": "203.0.113.42",
  "dst_ip": "192.168.1.10",
  "user": "alice@example.com",
  "action": "rejected|accepted|banned",
  "severity": "low|medium|high|critical",
  "raw": "<original log line>"
}
```

## 9.3 Risk-Score-Heuristik (Beispiel)

| Faktor | Gewicht |
|--------|---------|
| Anzahl Auth-Failures (24 h) | + (count × 2) |
| Land in Hochrisiko-Liste | + 30 |
| ASN ist Hosting/VPN | + 20 |
| CrowdSec-Decision aktiv | + 50 |
| Bekannte gute IP (Whitelist) | – 100 |

Ergebnis wird in `ip_risk_score` mit Zeitstempel persistiert.

## 9.4 Trigger via Dashboard

Im Dashboard unter **Tools** lassen sich die periodischen Jobs manuell anstoßen. Die zugehörigen API-Endpoints:

| Endpoint | Aufgabe |
|----------|---------|
| `POST /api/tools/run-enricher` | GeoIP/ASN-Lookup für neue IPs |
| `POST /api/tools/recompute-risk` | Risk-Scores neu berechnen |
| `POST /api/tools/rebuild-summary` | `ip_summary`-Tabelle aggregieren |

Diese Endpoints rufen den LogCollector via SSH oder HTTP-Trigger auf (Implementierung im LogCollector-Repo).

## 9.5 Empfohlene Cron-Schedule (LogCollector-VM)

```cron
*/5  * * * *  python3 /opt/logcollector/run_enricher.py
*/15 * * * *  python3 /opt/logcollector/run_risk_scorer.py
0    *  * * * python3 /opt/logcollector/run_summary.py
```

## 9.6 Monitoring

- Healthcheck-File `/var/lib/logcollector/last_run.txt` (mtime < 10 min)
- Uptime-Kuma „file age check" empfohlen
