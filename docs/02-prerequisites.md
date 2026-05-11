# 02 – Voraussetzungen

## 2.1 Hardware / VMs

| VM | vCPU | RAM | Disk | Zweck |
|----|------|-----|------|-------|
| **LogSrv** (Docker-Host) | 2 | 4 GB | 40 GB | Dashboard-Stack |
| **Authentik-VM** | 2 | 4 GB | 20 GB | SSO/OIDC |
| **LogServer-VM** | 2 | 4 GB | 60 GB+ | MariaDB + Python LogCollector |
| **OPNsense** | bestehend | – | – | Firewall + ACME |

## 2.2 Software

Auf **LogSrv**:

- Debian 12 oder 13 (minimal)
- Docker Engine ≥ 24
- `docker-compose-plugin` (compose v2)
- `git`, `curl`, `jq`, `rsync`

Auf **Authentik-VM**:

- Authentik ≥ 2024.10 (Docker oder Bare-Metal)
- Eigenes TLS-Zertifikat für `sso.servuswir.de`

Auf **LogServer-VM**:

- MariaDB ≥ 10.11 als Docker-Container `logserver-db` im Netz `logserver_default`
- Python 3.11+ für den LogCollector

## 2.3 DNS

| Record | Typ | Ziel |
|--------|-----|------|
| `logdash.servuswir.de` | A | öffentliche IP OPNsense → NAT auf LogSrv |
| `sso.servuswir.de` | A | öffentliche IP OPNsense → NAT auf Authentik-VM |

> TTL ≤ 5 min während der Erstinstallation, danach 1 h.

## 2.4 Public IP & Port-Forwards (OPNsense)

| WAN-Port | → LAN-Ziel:Port | Zweck |
|----------|-----------------|-------|
| 80/tcp | LogSrv:80 | ACME HTTP-01 + HTTP-Redirect |
| 443/tcp | LogSrv:443 | Dashboard |
| 9443/tcp | Authentik-VM:9443 | SSO-Login |

Details siehe [07 OPNsense-Setup](./07-opnsense-setup.md).

## 2.5 Accounts & Zugänge

Vor Beginn bereithalten:

- [ ] OPNsense-Admin (root)
- [ ] Authentik-Admin (`akadmin` + Initial-Password)
- [ ] Root-/sudo-Zugang auf der frischen LogSrv-VM
- [ ] MariaDB-Zugang auf der LogServer-VM (User mit Lesen-Recht auf `logdb`)
- [ ] GitHub-Lesezugriff auf `Softhuby99/logwatch-pal`
- [ ] Domain-Verwaltung (für DNS-Records + ggf. DNS-01 ACME-Challenge)
- [ ] Mailcow-API-Key (optional)
- [ ] CrowdSec Bouncer-Key (aus OPNsense-Plugin)

## 2.6 Skills

| Skill | Level |
|-------|-------|
| Linux-CLI | mittel |
| Docker / docker-compose | Grundlagen |
| DNS, TLS, Reverse-Proxy | Grundlagen |
| OPNsense GUI | Grundlagen |
| OIDC / OAuth2 | hilfreich |
