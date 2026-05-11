# 05 – TLS-Zertifikate

Das Dashboard benötigt ein gültiges TLS-Zertifikat für `logdash.servuswir.de`. Empfohlen: ACME (Let's Encrypt) über das **OPNsense `os-acme-client`-Plugin**.

## 5.1 Variante A – OPNsense ACME (empfohlen)

### A.1 Plugin installieren

OPNsense → **System → Firmware → Plugins** → `os-acme-client` installieren.

### A.2 ACME-Account anlegen

**Services → ACME Client → Accounts → +**

| Feld | Wert |
|------|------|
| Name | `letsencrypt-prod` |
| ACME CA | Let's Encrypt |
| E-Mail | `admin@servuswir.de` |

→ **Register** klicken.

### A.3 Challenge-Type wählen

**Challenge Types → +**

**Variante HTTP-01** (einfacher, benötigt offenen Port 80):

| Feld | Wert |
|------|------|
| Name | `http01-logdash` |
| Challenge Type | HTTP-01 |
| HTTP Service | Use built-in web service (Port 43580) |

→ in OPNsense **Firewall → NAT → Port Forward** Regel anlegen:
- WAN TCP 80 → `<OPNsense-LAN-IP>` Port 43580 **nur während ACME-Challenge** (oder dauerhaft, wenn OPNsense Port 80 hostet; sonst kollidiert es mit dem NAT auf LogSrv → siehe Variante DNS-01).

**Variante DNS-01** (empfohlen wenn Port 80 nach LogSrv NAT'tet wird):

| Feld | Wert |
|------|------|
| Name | `dns01-logdash` |
| Challenge Type | DNS-01 |
| DNS Service | z. B. Cloudflare / Hetzner / etc. |
| API-Token | <DNS-Provider-Token> |

### A.4 Zertifikat anlegen

**Certificates → +**

| Feld | Wert |
|------|------|
| Name | `logdash-servuswir-de` |
| Common Name | `logdash.servuswir.de` |
| ACME Account | `letsencrypt-prod` |
| Challenge Type | siehe oben |
| Auto Renewal | ✔ |

→ **Issue/Renew Certificate** klicken. Status muss „OK" werden.

### A.5 Auto-Verteilung auf LogSrv

**Automations → +**

| Feld | Wert |
|------|------|
| Name | `deploy-logdash-cert` |
| Run Command | `Upload certificate to remote host (SCP)` |
| Remote Host | `<LogSrv-IP>` |
| Remote User | `acme-deploy` (auf LogSrv anlegen, SSH-Key hinterlegen) |
| Remote Path | `/opt/dashboard/deploy/certs/` |
| Files | `fullchain.pem`, `privkey.pem` |
| Post-Command | `sudo docker exec deploy-proxy-1 nginx -s reload` |

→ Im Cert die Automation verknüpfen. Auto-Renewal alle 60 Tage.

**`acme-deploy`-User auf LogSrv:**

```bash
useradd -m -s /bin/bash acme-deploy
mkdir /home/acme-deploy/.ssh
# Public-Key des OPNsense-ACME-Plugins eintragen
echo "ssh-ed25519 AAAA...opnsense" > /home/acme-deploy/.ssh/authorized_keys
chown -R acme-deploy:acme-deploy /home/acme-deploy/.ssh
chmod 700 /home/acme-deploy/.ssh
chmod 600 /home/acme-deploy/.ssh/authorized_keys

# sudoers-Snippet für Reload
cat > /etc/sudoers.d/acme-deploy <<'EOF'
acme-deploy ALL=(root) NOPASSWD: /usr/bin/docker exec deploy-proxy-1 nginx -s reload, /usr/bin/cp /tmp/fullchain.pem /opt/dashboard/deploy/certs/, /usr/bin/cp /tmp/privkey.pem /opt/dashboard/deploy/certs/
EOF
chmod 440 /etc/sudoers.d/acme-deploy
```

### A.6 Berechtigungen

```bash
chmod 600 /opt/dashboard/deploy/certs/privkey.pem
chmod 644 /opt/dashboard/deploy/certs/fullchain.pem
chown root:root /opt/dashboard/deploy/certs/*
```

## 5.2 Variante B – manuell mit `certbot` auf LogSrv

```bash
apt install -y certbot
systemctl stop docker  # Port 80 freigeben
certbot certonly --standalone -d logdash.servuswir.de \
  -m admin@servuswir.de --agree-tos --non-interactive
cp /etc/letsencrypt/live/logdash.servuswir.de/fullchain.pem \
   /opt/dashboard/deploy/certs/
cp /etc/letsencrypt/live/logdash.servuswir.de/privkey.pem \
   /opt/dashboard/deploy/certs/
systemctl start docker
docker exec deploy-proxy-1 nginx -s reload
```

Renewal-Hook: `/etc/letsencrypt/renewal-hooks/deploy/dashboard.sh`

```bash
#!/bin/bash
cp /etc/letsencrypt/live/logdash.servuswir.de/fullchain.pem /opt/dashboard/deploy/certs/
cp /etc/letsencrypt/live/logdash.servuswir.de/privkey.pem /opt/dashboard/deploy/certs/
docker exec deploy-proxy-1 nginx -s reload
```

```bash
chmod +x /etc/letsencrypt/renewal-hooks/deploy/dashboard.sh
```

## 5.3 Variante C – Eigene CA (nur für interne Tests)

```bash
openssl req -x509 -newkey rsa:4096 -nodes -days 365 \
  -keyout /opt/dashboard/deploy/certs/privkey.pem \
  -out /opt/dashboard/deploy/certs/fullchain.pem \
  -subj "/CN=logdash.servuswir.de"
```

Browser meldet dann „NET::ERR_CERT_AUTHORITY_INVALID" – nur in Lab-Umgebungen verwenden.

## 5.4 Authentik-Zertifikat

Gleicher Ablauf für `sso.servuswir.de` auf der Authentik-VM. Alternativ ein **Wildcard-Cert** `*.servuswir.de` per DNS-01 erzeugen und auf beide VMs verteilen.

## 5.5 Verifikation

```bash
# Cert-Inhalt
openssl x509 -in /opt/dashboard/deploy/certs/fullchain.pem -text -noout | head -20

# Live-Test
echo | openssl s_client -connect logdash.servuswir.de:443 -servername logdash.servuswir.de 2>/dev/null \
  | openssl x509 -noout -dates -subject -issuer
```

## 5.6 Renewal überwachen

OPNsense → **Services → ACME Client → Log Files** → letzter Run grün?
Optional Uptime-Kuma-Check auf Cert-Ablauf < 14 Tage.
