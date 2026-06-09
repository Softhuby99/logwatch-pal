## Ziel
Frontend-Dashboard zeigt zuverlässig die echten Werte der API (`/api/stats`, `/api/attack-timeline`, …) an, statt stillschweigend Fallback-/Mock-Daten zu rendern, wenn `/api/...` HTML zurückliefert (Vite-Preview, falsch konfigurierter Proxy).

## Bestätigte Fakten aus dem Server
- API läuft auf `deploy-api-1`, Port **3001** (intern + Host-Mapping `127.0.0.1:3001`).
- `/api/stats` und `/api/attack-timeline` liefern valides JSON (z. B. `auth_failures.value = 18`, `h24 = 9`).
- Container ist trotzdem als **unhealthy** markiert → Healthcheck im Compose ruft vermutlich noch Port 3000/falschen Pfad auf (außerhalb des Frontend-Scopes, nur Hinweis).
- DB: `deploy-db-1` (Postgres 16, healthy).
- Proxy: `deploy-proxy-1` (nginx) bedient 80/443 – aktuell ohne `/api`-Upstream auf `api:3001`.

## Frontend-Änderungen (umzusetzen)

### 1. Einheitliche API-Basis
- Alle Calls gehen über einen zentralen Helper in `src/lib/api.ts`.
- Basis: `import.meta.env.VITE_API_URL || "/api"`.
- Komponenten dürfen keine eigenen `fetch("/api/...")`-Pfade mehr zusammensetzen, nur Helper-Funktionen (`getStats()`, `getAttackTimeline()`, `getGeoAttacks()`, `getSecurityEvents()` …).

### 2. HTML-Erkennung & harte Fehlschläge
Im Helper:
- Response prüfen: `content-type` enthält `application/json` UND Body beginnt nicht mit `<`.
- Bei HTML / Nicht-JSON / `!res.ok`: `throw new ApiError(...)` statt Mock-Daten zurückzugeben.
- Aufrufende Hooks (React Query) gehen sauber in `error`-State, UI zeigt klar „Offline / API nicht erreichbar".

### 3. Live-/Fallback-Sichtbarkeit
- Bestehendes `live: boolean`-Flag durchgängig nutzen.
- Header bekommt einen einzigen Statusindikator: grün „Live" (alle Kern-Endpoints OK), gelb „Teilweise", rot „Offline (Fallback)".
- Karten/Charts zeigen bei `error` einen kleinen „API offline" Hinweis statt stiller Demo-Zahlen.

### 4. Dev-/Preview-Konfiguration
- `vite.config.ts`: Dev-Proxy `'/api' -> process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3001'`, `changeOrigin: true`.
- `.env.example` mit `VITE_API_URL=/api` und Kommentar zu `VITE_API_PROXY_TARGET` für lokale Entwicklung.
- In der Lovable-Preview (kein Zugriff auf private Host-API) sorgt Schritt 2 dafür, dass die UI ehrlich „Offline" anzeigt, statt Fantasiezahlen zu rendern.

### 5. Validierung nach Umbau
- In Browser-Preview: Netzwerk-Tab prüfen → `/api/stats` Response = HTML → UI zeigt „Offline".
- Auf der Server-VM (`https://<host>` über nginx, sobald Proxy `/api → api:3001` eingerichtet ist): Karten zeigen exakt die curl-Werte (`security_events 1010 / 49 / 262 / 1010`, `auth_failures 18 / 9 / 14 / 18` etc.).
- Dashboard-Versionsnummer in `src/pages/Index.tsx` um eine Minor-Stelle erhöhen (gemäß Projektregel).

## Bewusst NICHT enthalten
- Änderungen an Auth/OIDC.
- Neue API-Endpoints – alle benötigten Daten liefert die API bereits.
- Server-/Compose-/nginx-Änderungen (Healthcheck, `/api`-Upstream) – das sind separate Ops-Schritte, die du auf der VM ausführst:
  - Healthcheck im Compose auf `wget -qO- http://127.0.0.1:3001/api/stats` umstellen.
  - nginx-Proxy: `location /api/ { proxy_pass http://api:3001; }`.

Sag „go", dann setze ich die Frontend-Schritte 1–5 um.