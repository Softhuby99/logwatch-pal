# 08 – SSH-Log-Abholung

Der `api`-Container holt Logs per SSH von Remote-Hosts (Mailserver, Webserver, etc.) und sendet sie an den LogCollector.

## 8.1 Architektur

- Im `api`-Container wird beim ersten Start ein **ed25519-Keypair** erzeugt:
  `/home/node/.ssh/id_ed25519_dashboard`
- Persistiert im Docker-Volume `api_ssh`.
- Auf jedem Remote-Host läuft ein dedizierter, auf `tail`/`cat` beschränkter User `logreader`.

## 8.2 Public-Key auslesen

```bash
docker compose -f /opt/dashboard/deploy/docker-compose.yml exec api \
  cat /home/node/.ssh/id_ed25519_dashboard.pub
```

Ausgabe-Beispiel:

```
ssh-ed25519 AAAAC3Nz...== dashboard@logsrv
```

## 8.3 `logreader`-User auf jedem Remote-Host

```bash
useradd -m -s /bin/bash logreader
mkdir -p /home/logreader/.ssh
chmod 700 /home/logreader/.ssh

cat > /home/logreader/.ssh/authorized_keys <<'EOF'
from="<LogSrv-IP>",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty,command="/usr/local/bin/log-export.sh" ssh-ed25519 AAAAC3Nz...== dashboard@logsrv
EOF

chown -R logreader:logreader /home/logreader/.ssh
chmod 600 /home/logreader/.ssh/authorized_keys
```

## 8.4 Restricted-Command-Wrapper

`/usr/local/bin/log-export.sh`:

```bash
#!/bin/bash
# Whitelist erlaubter Aufrufe – verhindert beliebige Befehle
case "$SSH_ORIGINAL_COMMAND" in
  "tail -n "*" /var/log/auth.log") exec $SSH_ORIGINAL_COMMAND ;;
  "tail -n "*" /var/log/mail.log") exec $SSH_ORIGINAL_COMMAND ;;
  "tail -n "*" /var/log/fail2ban.log") exec $SSH_ORIGINAL_COMMAND ;;
  "cat /var/log/auth.log")  exec $SSH_ORIGINAL_COMMAND ;;
  *) echo "Forbidden: $SSH_ORIGINAL_COMMAND" >&2; exit 1 ;;
esac
```

```bash
chmod +x /usr/local/bin/log-export.sh
```

## 8.5 sudoers (falls Logs root:adm sind)

`/etc/sudoers.d/logreader`:

```
logreader ALL=(root) NOPASSWD: /usr/bin/tail -n * /var/log/auth.log, /usr/bin/tail -n * /var/log/mail.log, /usr/bin/tail -n * /var/log/fail2ban.log
```

```bash
chmod 440 /etc/sudoers.d/logreader
visudo -c
```

Wrapper-Script entsprechend mit `sudo` davor anpassen.

## 8.6 `REMOTE_HOSTS` in `.env`

```
REMOTE_HOSTS=logreader@mail.lan:22,logreader@web.lan:22,logreader@dns.lan:22
```

Format: `user@host[:port]`, komma-getrennt.

## 8.7 Quellen-Tabelle

| Host | Logs | Pfad | Owner | Rotation |
|------|------|------|-------|----------|
| `mail.lan` | Postfix, Dovecot | `/var/log/mail.log` | `root:adm` | logrotate täglich |
| `web.lan` | nginx-Auth | `/var/log/auth.log` | `root:adm` | täglich |
| jeder | Fail2ban | `/var/log/fail2ban.log` | `root:adm` | täglich |
| `opnsense.lan` | – | über API (Kap. 07) | – | – |

## 8.8 Verbindung testen

```bash
docker compose exec api ssh -i /home/node/.ssh/id_ed25519_dashboard \
  -o StrictHostKeyChecking=accept-new \
  logreader@mail.lan "tail -n 5 /var/log/mail.log"
```

## 8.9 Key-Rotation (jährlich)

```bash
# Neuen Key erzeugen
docker compose exec api ssh-keygen -t ed25519 -N "" \
  -f /home/node/.ssh/id_ed25519_dashboard.new

# Public-Key auf allen Remotes hinzufügen (nicht ersetzen)
# Test mit neuem Key
# Alten Key auf Remotes entfernen
# Im Container alten Key durch neuen ersetzen
```

## 8.10 Sicherheitshinweise

- **Niemals** root-SSH-Login zulassen.
- `from="..."` in `authorized_keys` schränkt auf LogSrv-IP ein.
- Wrapper-Script ist die letzte Verteidigungslinie – Whitelist eng halten.
- Zusätzlich `fail2ban` auf den Remote-Hosts aktivieren.
