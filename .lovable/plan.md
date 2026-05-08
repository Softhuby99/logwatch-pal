# Was du tun sollst

Du hast bisher nichts auf deinem Server, weil ich im Plan-Modus bin und noch keine Datei geschrieben habe. Wenn du den Plan freigibst, lege ich genau **eine neue Datei** an:

```
deploy/diagnose-502.sh
```

Danach machst du auf deinem Log-Server **drei** Dinge:

```bash
cd /opt/dashboard
git pull
bash deploy/diagnose-502.sh
```

Das Script macht **keine** Änderungen am System. Es liest nur Status aus und gibt am Ende eine klare Zeile aus, **wo** die 502-Kette bricht.

# Was das Script prüft (in dieser Reihenfolge)

1. **Container-Status**
   `docker compose ps` für `api` und `dashboard` — laufen beide? `healthy`?

2. **API direkt auf dem Host**
   `curl -fsS http://127.0.0.1:3001/api/version`
   → muss `0.6.5-auth-success-chart` liefern (wissen wir schon, dient als Baseline).

3. **Dashboard-Container intern erreichbar?**
   `curl -fsS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:${DASHBOARD_PORT:-8080}/`
   → erwartet `200`. Wenn `000`/Connection refused → Dashboard-Container down oder Port-Bind falsch.

4. **Dashboard → API intern (Docker-DNS)**
   `docker compose exec dashboard wget -qO- http://api:3001/api/version`
   → erwartet `0.6.5...`. Wenn leer/Fehler → das interne Nginx im Dashboard-Container hat **stale DNS** auf den alten `api`-Container (das ist der wahrscheinlichste 502-Grund nach `--force-recreate api dashboard`).

5. **Authentik-Outpost lebt?**
   `curl -kI https://192.168.3.12:9443/` (aus deiner `dashboard.conf` für `/sso/`)
   → erwartet `200/302`. Wenn nicht → Authentik-Kette ist die Ursache, nicht das Dashboard.

6. **OPNsense-Edge**
   `curl -kI https://logdash.servuswir.de/` und `curl -kI https://logdash.servuswir.de/api/version`
   → zeigt, wo OPNsense den 502 wirft (auf `/` oder erst auf `/api/`).

7. **Letzte 50 Logzeilen** von `api` und `dashboard` (`docker compose logs --tail=50 api dashboard`).

# Auswertung – was du mir danach schickst

Einfach die **komplette Ausgabe** des Scripts in den Chat. Anhand der Zeilen 3, 4 und 6 sehe ich eindeutig:

- Bricht es bei **3** → Dashboard-Container nicht da/Port falsch.
- Bricht es bei **4** → bestätigtes Stale-DNS-Problem im internen Nginx → Fix: `docker compose restart dashboard` (sofortiger Test) und danach dauerhaft Resolver in `dashboard.conf`.
- Bricht es nur bei **6** → Problem liegt **außerhalb** deines Stacks (OPNsense-Upstream-Cache oder Authentik-Outpost), nicht im Dashboard.

# Was ich in diesem Schritt **nicht** anfasse

- Keine Änderung an `dashboard.conf` (der in #966 bewusst zurückgerollte Stand bleibt).
- Keine Änderung an `sync.sh`.
- Keine Änderung an React-Code, OPNsense, Authentik.

Erst wenn die Diagnose-Ausgabe eindeutig ist, schlage ich **gezielt** den passenden Mini-Fix vor – nicht vorher.
