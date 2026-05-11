# 13 – Security-Checklist

## 13.1 Secrets

- [ ] `deploy/.env` `chmod 600`, owner root
- [ ] `.env` **niemals** committen (`.gitignore` enthält `deploy/.env`)
- [ ] Secrets-Rotation alle 12 Monate (DB, OPNsense-API, CrowdSec-Bouncer, OIDC-Client)
- [ ] Offsite-Backups GPG-verschlüsselt

## 13.2 TLS

- [ ] Zertifikat von Let's Encrypt (oder kommerziell), kein Self-Signed in Prod
- [ ] HSTS aktiv (in nginx-Template)
- [ ] TLSv1.2 + 1.3 only
- [ ] Auto-Renewal funktioniert (Test: Cert-Ablauf in < 30 Tagen?)

## 13.3 Authentifizierung

- [ ] Authentik `akadmin` mit MFA (TOTP)
- [ ] Default-Bootstrap-Passwort geändert
- [ ] User-Gruppe `dashboard-users` als Application-Binding (kein „alle dürfen rein")
- [ ] OIDC-Client-Type **Public** + PKCE (kein Secret im Frontend!)

## 13.4 Netzwerk

- [ ] OPNsense-Floating-Rules: Admin-Zugang ggf. auf VPN/IP-Whitelist beschränken
- [ ] Anti-Lockout-Rule aktiv
- [ ] CrowdSec aktiviert + Bouncer auf OPNsense
- [ ] Fail2ban auf allen Remote-Hosts

## 13.5 SSH

- [ ] root-Login disabled (`PermitRootLogin no`)
- [ ] Password-Login disabled (`PasswordAuthentication no`)
- [ ] `logreader` mit `from="..."` + restricted command
- [ ] Public-Key des `api`-Containers nur auf nötigen Hosts

## 13.6 Updates

- [ ] `unattended-upgrades` für OS-Sicherheitsupdates
- [ ] Monatlicher Image-Update-Termin (siehe [11 Betrieb](./11-operations.md#update))
- [ ] Authentik + OPNsense in Maintenance-Window

## 13.7 Monitoring & Audit

- [ ] Uptime-Kuma extern
- [ ] Disk-Alert (PG-Volume, Backup-Pfad)
- [ ] Authentik-Events regelmäßig sichten (Logins, Failures)
- [ ] OPNsense Firewall-Logs per Syslog → LogServer

## 13.8 DSGVO / Datenschutz

Im Dashboard verarbeitete personenbezogene Daten:

| Datentyp | Quelle | Aufbewahrung | Rechtsgrundlage |
|----------|--------|--------------|-----------------|
| IP-Adressen | Logs aller Quellen | 90 Tage (konfigurierbar) | Art. 6 Abs. 1 lit. f (berechtigtes Interesse: IT-Sicherheit) |
| Login-Namen / Mail-Adressen | Mail-Logs, Authentik | 90 Tage | dito |
| GeoIP / ASN | MaxMind-Lookup | 30 Tage | Pseudonymisierung |
| Authentik-User-Profile | SSO | bis Account-Löschung | Art. 6 Abs. 1 lit. b |

**Pflichten:**

- Verzeichnis von Verarbeitungstätigkeiten (VVT) führen
- Auftragsverarbeitungsvertrag (AVV) mit MaxMind/Hostern, falls relevant
- Auskunftsrecht: Suche nach IP/User in der MariaDB möglich
- Löschpflicht: Retention via Partitionierung (siehe [10 DB-Schema](./10-database-schema.md#104-retention))

## 13.9 Härtung Quick-Wins

```bash
# OS
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

# Docker
echo '{"log-driver":"json-file","log-opts":{"max-size":"10m","max-file":"3"}}' \
  > /etc/docker/daemon.json
systemctl restart docker

# Kernel
cat >> /etc/sysctl.d/99-hardening.conf <<EOF
net.ipv4.tcp_syncookies=1
net.ipv4.conf.all.rp_filter=1
kernel.kptr_restrict=2
EOF
sysctl --system
```
