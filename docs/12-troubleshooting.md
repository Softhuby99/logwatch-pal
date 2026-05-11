# 12 – Troubleshooting

Symptom-basierte Fehlerbehebung.

## 12.1 `404 Cannot GET /api/...` im Browser

**Ursache:** nginx im `proxy`-Container hängt `$request_uri` nicht an, wenn `proxy_pass` eine Variable enthält.

**Fix:** in `deploy/nginx/templates/default.conf.template` muss stehen:

```nginx
location /api/ {
  set $api_upstream http://api:3001;
  proxy_pass $api_upstream$request_uri;
  ...
}
```

```bash
docker compose -f deploy/docker-compose.yml up -d --force-recreate proxy
```

## 12.2 `502 Bad Gateway`

```bash
docker compose -f deploy/docker-compose.yml ps
docker compose -f deploy/docker-compose.yml logs --tail=50 api
```

- Container down → starten
- nginx hat alte IP gecached → `up -d --force-recreate proxy` (Resolver `127.0.0.11 valid=10s` muss aktiv sein)

## 12.3 OIDC-Redirect-Loop

**Mögliche Ursachen:**

| Ursache | Check | Fix |
|---------|-------|-----|
| Redirect-URI Mismatch | Browser-Konsole zeigt `redirect_uri does not match` | exakte URI in Authentik-Provider eintragen |
| Clock-Skew > 60 s | `timedatectl` auf beiden VMs | NTP synchronisieren |
| `VITE_OIDC_AUTHORITY` falsch | Browser-Network-Tab → Discovery-URL 404 | Slug `log-dashboard` prüfen, Frontend neu bauen |
| Cookie-Domain | dritte SSO-Sub-Domain | gleiche Parent-Domain nutzen |

## 12.4 MariaDB nicht erreichbar

```
Error: connect ECONNREFUSED logserver-db:3306
```

```bash
docker network ls | grep logserver_default || \
  docker network create logserver_default

# api-Container in Netz?
docker inspect deploy-api-1 | jq '.[0].NetworkSettings.Networks'
```

In `.env`: `LOGDB_NETWORK=logserver_default` muss exakt dem Netznamen entsprechen.

## 12.5 TLS-Zertifikat ungültig / abgelaufen

```bash
echo | openssl s_client -connect logdash.servuswir.de:443 2>/dev/null \
  | openssl x509 -noout -dates
```

→ ACME-Renewal in OPNsense prüfen (Services → ACME Client → Log Files), ggf. manuell „Issue/Renew Certificate".

## 12.6 SSH-Logs leer

```bash
docker compose exec api ssh -i /home/node/.ssh/id_ed25519_dashboard \
  -o BatchMode=yes logreader@mail.lan "tail -n 5 /var/log/mail.log"
```

| Fehler | Fix |
|--------|-----|
| `Permission denied (publickey)` | Public-Key fehlt in `authorized_keys` |
| `Forbidden: ...` | Wrapper-Script blockt – Whitelist erweitern |
| `Permission denied` beim Lesen | sudoers-Snippet fehlt |

## 12.7 Build-Fehler beim Frontend

```bash
docker compose build --no-cache --progress=plain dashboard 2>&1 | tail -50
```

- Node-Memory: `NODE_OPTIONS=--max-old-space-size=4096` in `Dockerfile.dashboard` setzen
- Lock-File-Konflikt: `bun.lock` mit Repo-Stand abgleichen

## 12.8 CrowdSec-API liefert leer

```bash
curl -sH "X-Api-Key: $CROWDSEC_BOUNCER_KEY" \
  http://opnsense.lan:8081/v1/decisions
```

→ Bouncer-Key falsch / OPNsense-Firewall blockiert Port 8081 vom LogSrv-Netz.

## 12.9 Diagnose-Toolbox

Im Repo: `deploy/diagnose-502.sh` führt die wichtigsten Checks automatisch aus.

```bash
bash /opt/dashboard/deploy/diagnose-502.sh
```
