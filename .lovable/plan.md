# GeoIP-Karte zeigt Mock-Daten statt Live-Werten

## Root Cause

`src/components/dashboard/GeoAttackMap.tsx` und `CountryDetailSheet.tsx` rufen `getCountryAttackStats()` bzw. `getCountryDetail()` aus `src/lib/geoAttacks.ts` auf. Diese Funktionen aggregieren **ausschließlich `mockSecurityEvents` / `mockAuthEvents` / `mockIPEnrichment`** — also statische Demo-Daten, die zur Build-Zeit eingefroren wurden. Sie machen **keinen Fetch** auf die API.

Es gibt zwar einen API-Endpoint `GET /api/geo-attacks` und `fetchGeoAttacks()` in `src/lib/api.ts` — der wird aber **nirgendwo aufgerufen**. Deshalb aktualisieren sich Länder/IPs/Standorte nie, egal wie viele neue Events in MariaDB landen oder wie oft du den Enricher startest.

Zusätzlich liefert der bestehende `/api/geo-attacks` nur `{country, count, bans, last_seen}` — ohne Regionen und ohne IP-Drilldown. Für die Karte mit Region-Bubbles und den Country-Detail-Sheet (IP-Tabelle) reicht das nicht.

## Plan

### 1. API erweitern (`deploy/api/server.js`)

**a) `/api/geo-attacks` erweitern** — zusätzlich `unique_ips`, `auth_failures`, `crit_events`, `warn_events`, `max_risk_score`, `attack_weight` aus `security_events` + `auth_events` + `ip_risk_score` zurückgeben. Regionen lassen wir vorerst weg (kein Region-Feld in `ip_enrichment` laut Schema), Bubbles werden dann pro Land als **eine** Bubble dargestellt.

**b) Neuer Endpoint `GET /api/geo/country/:iso2`** — liefert IP-Liste für ein Land:
```
{ iso2, ips: [{ ip, events, bans, auth_failures, last_alert,
                 org_name, asn, ptr, risk_score, risk_level }],
  totals: {...} }
```
Query joint `ip_enrichment` (gefiltert nach `country = ?` und `ip_scope = 'external'`) mit Event-Counts aus `security_events`/`auth_events` und `ip_risk_score`.

### 2. Frontend auf API umstellen

**`src/lib/geoAttacks.ts`**
- Mock-Imports und `eventCountByIp()`/`REGIONS_BY_COUNTRY` entfernen.
- `getCountryAttackStats()` und `getCountryDetail()` → in **async-Fetcher** umwandeln, die `apiFetch` über die neuen Endpoints nutzen (mit leerem Fallback). ISO2→ISO3/Name-Mapping (`COUNTRY_TABLE`) bleibt clientseitig.

**`src/components/dashboard/GeoAttackMap.tsx`**
- `useMemo(getCountryAttackStats())` → `useApiData(fetchCountryStats, [])` (nutzt globalen Refresh-Intervall).
- Bei leerem `stats` Loading-/Empty-State zeigen.
- Region-Bubbles auf eine Bubble pro Land reduzieren (`unique_ips` als Größe), da keine echten Region-Daten existieren. Tooltip/Card-UI bleibt sonst gleich.

**`src/components/dashboard/CountryDetailSheet.tsx`**
- `useMemo(getCountryDetail(iso2))` → `useApiData(() => fetchCountryDetail(iso2), [iso2])`. Loading-Spinner anzeigen.

### 3. Dashboard-Version

`src/pages/Index.tsx`: Header-Version `v0.5` → `v0.6` (laut Core-Memory-Regel bei jedem Frontend-Update).

## Was nicht geändert wird

- MaxMind/ip-api-Enrichment selbst (läuft bereits, du hast die Backfill-Tools).
- Mock-Daten bleiben als Datei (werden von anderen Komponenten noch genutzt) — nur die Imports in `geoAttacks.ts` entfallen.
- Layout/Design der Karte unverändert; nur die Datenquelle wechselt.

## Verifikation nach Implementierung

1. `docker compose build dashboard api && docker compose up -d dashboard api`
2. Strg+Shift+R im Browser → Header zeigt `v0.6`.
3. Karte sollte denselben Stand wie `curl http://<host>/api/geo-attacks` zeigen.
4. Nach Klick auf ein Land lädt das Sheet die IP-Liste live aus `/api/geo/country/<iso2>`.
5. Neuer Enricher-Lauf + Refresh → IPs/Länder erscheinen ohne Rebuild.
