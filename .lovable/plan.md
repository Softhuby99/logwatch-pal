## Problem

Alle `/api/...` Aufrufe vom Browser liefern HTTP 404 mit Body `Cannot GET /api/`. Direktcalls auf `http://127.0.0.1:3001/api/stats` funktionieren — der Bug liegt also nicht in der API, sondern im **bundled `proxy`** (`deploy/nginx/templates/default.conf.template`).

Nginx hängt bei `proxy_pass` mit Variable den Location-Suffix nicht mehr an die Upstream-URL an. Die aktuelle Direktive

```
proxy_pass $api_upstream/api/;
```

sendet daher *immer* nur `/api/` an den Node-Server, egal ob `/api/stats` oder `/api/top-attackers` reinkommt. Express antwortet konsequenterweise mit 404.

Dasselbe Problem steckt latent in der `/auth/`-Location (fällt nur deshalb nicht auf, weil das Frontend Authentik aktuell direkt unter `sso.servuswir.de:9443` anspricht und nicht über den eigenen `/auth/`-Pfad).

## Fix

In `deploy/nginx/templates/default.conf.template` jeweils auf `$request_uri` umstellen, damit der vollständige Originalpfad an den Upstream geht — mit weiterhin dynamischer DNS-Auflösung über den Docker-Resolver.

```text
location /api/ {
  set $api_upstream http://api:3001;
  proxy_pass $api_upstream$request_uri;     # NEU
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto https;
}

location /auth/ {
  set $authentik_upstream https://sso.servuswir.de:9443;
  proxy_pass $authentik_upstream$request_uri;   # NEU
  proxy_ssl_server_name on;
  proxy_set_header Host sso.servuswir.de:9443; # Authentik validiert Host-Header
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto https;
}
```

`/auth/callback` (für SPA) und `/` bleiben unverändert — die funktionieren bereits korrekt, weil dort kein Pfad-Suffix angehängt werden muss.

## Deployment auf der VM

Nach dem Pull keinen Image-Rebuild nötig (nur das Template-Volume des Proxy):

```bash
cd /opt/dashboard
git pull
docker compose -f deploy/docker-compose.yml up -d --force-recreate proxy
```

## Verifizierung

```bash
# muss jetzt 200 + JSON liefern
curl -ki -H "Host: logdash.servuswir.de" https://127.0.0.1/api/stats | head
```

Anschließend im Browser `https://logdash.servuswir.de/` neu laden — Stats-Cards, Top-Attackers, Crowdsec-Alerts etc. müssen sich füllen.
