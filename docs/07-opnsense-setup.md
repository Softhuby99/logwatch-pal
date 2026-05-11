# 07 – OPNsense-Setup

Konfiguration der OPNsense für Dashboard + Authentik + Log-Quellen.

## 7.1 Aliases

**Firewall → Aliases → +**

| Name | Typ | Inhalt |
|------|-----|--------|
| `LogSrv` | Host(s) | LAN-IP des Docker-Hosts |
| `AuthentikVM` | Host(s) | LAN-IP der Authentik-VM |
| `AdminNets` | Network(s) | optional Whitelist (z. B. `192.168.1.0/24`) |

## 7.2 NAT Port-Forwards

**Firewall → NAT → Port Forward → +**

| Interface | Proto | Dest Port | Redirect Target | Redirect Port | Beschreibung |
|-----------|-------|-----------|-----------------|---------------|--------------|
| WAN | TCP | 80 | `LogSrv` | 80 | ACME-HTTP-01 + HTTP→HTTPS Redirect |
| WAN | TCP | 443 | `LogSrv` | 443 | Dashboard HTTPS |
| WAN | TCP | 9443 | `AuthentikVM` | 9443 | SSO-Login |

→ jeweils **Filter rule association: Add associated filter rule** anhaken.

## 7.3 Floating Rules (optional, IP-Whitelist)

**Firewall → Rules → Floating → +**

- Quick: ✔, Direction: in, Interface: WAN
- Source: `AdminNets`
- Destination: `LogSrv`
- Port: 443
- Action: Pass

Eine zweite Block-Regel darunter blockiert alles andere.

## 7.4 ACME-Plugin

Siehe [05 Zertifikate](./05-certificates.md).

## 7.5 API-User für Dashboard

**System → Access → Users → +**

| Feld | Wert |
|------|------|
| Username | `dashboard-api` |
| Login shell | `/sbin/nologin` |
| Disable user | ☐ |
| Effective Privileges | nur folgende: |
|  | `Diagnostics: System Activity` |
|  | `Status: Firewall Logs` |
|  | `Status: Services` |
|  | `Firewall: Log Files` |
|  | `System: Status` |

→ Speichern → User editieren → **API keys → +** → generierten Key + Secret in die `.env`:

```
OPNSENSE_API_KEY=<key>
OPNSENSE_API_SECRET=<secret>
```

## 7.6 CrowdSec-Plugin

**System → Firmware → Plugins** → `os-crowdsec` installieren.

**Services → CrowdSec → Bouncers → +**

| Feld | Wert |
|------|------|
| Name | `dashboard-bouncer` |
| Type | API |

→ generierten Key in `.env`:

```
CROWDSEC_LAPI_URL=http://opnsense.lan:8081
CROWDSEC_BOUNCER_KEY=<key>
```

LAPI-Port (8081) muss vom `api`-Container erreichbar sein – ggf. NAT/Routing prüfen.

## 7.7 Remote Syslog (für Mailcow & Co.)

**Services → Syslog → Configure** → Destination `udp://logserver-vm:514` für die Mailcow-VM eintragen, sodass der Python-LogCollector die Logs sehen kann. (Alternativ: Mailcow direkt → LogServer-VM via syslog konfigurieren.)

## 7.8 Anti-Lockout

Bei IP-Whitelisting **immer** die Anti-Lockout-Rule für das LAN-Interface aktiv lassen:

**Firewall → Settings → Advanced** → ☑ `Disable anti-lockout` darf NICHT aktiv sein.

## 7.9 Verifikation

```bash
# API-Test (vom api-Container oder LogSrv)
curl -ks -u "$OPNSENSE_API_KEY:$OPNSENSE_API_SECRET" \
  https://opnsense.lan/api/core/system/status | jq .

# CrowdSec
curl -s -H "X-Api-Key: $CROWDSEC_BOUNCER_KEY" \
  http://opnsense.lan:8081/v1/decisions | jq .
```
