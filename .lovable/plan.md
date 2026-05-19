## Problem

In der Demo werden Bans korrekt als "aktiv" und "beendet" dargestellt, weil die Mock-Daten zu jedem `ban`-Event ein passendes `unban`-Event enthalten. `computeBanIntervals` in `src/lib/ipTimeline.ts` paart diese Paare und setzt `active=false` + `unbanned_at`.

In der Live-Umgebung sehen wir nie ein "beendet", weil die Pipeline (Loki/Promtail → MySQL) zwar `ban_status='banning'` schreibt, aber **keine korrespondierenden `unbanning`-Events** in `security_events` ankommen. Belege:

- In `deploy/api/server.js` wird ausschließlich `ban_status = 'banning'` gezählt — kein einziges `unbanning` wird gelesen oder zurückgegeben.
- Die Tabelle `ip_summary` hat dagegen ein Feld `current_status` ('banned' / 'clean' …), das den aktuellen Zustand abbildet.
- Folge: Alle Live-Intervalle laufen im Frontend in den `openBans`-Zweig und werden als `active=true` gerendert → durchgehend rot.

## Lösung

Drei Bausteine, vom Frontend her ohne Backend-Ingestion-Änderung umsetzbar:

### 1. Diagnose-Endpoint (klein, optional, hilft Verifikation)
Im API-Server kurzes Logging / einen Counter, wie viele `unbanning`-Events pro IP in `security_events` existieren. Wenn das wirklich 0 ist, ist der nächste Schritt nötig.

### 2. Heuristisches Ableiten des Ban-Endes im Frontend
`computeBanIntervals` in `src/lib/ipTimeline.ts` so erweitern, dass ein offener Ban automatisch als **beendet** markiert wird, sobald eine der folgenden Bedingungen zutrifft:

a. **Folge-Ban**: Tritt nach einem offenen Ban derselben IP ein *neuer* `ban`-Event auf, wird der vorige Ban auf `unbanned_at = neuer ban.event_time` gesetzt (`active=false`, Grund: "implizit beendet — neuer Ban folgte"). Das deckt die häufigste Realität ab (CrowdSec/Fail2Ban verlängert/erneuert Bans regelmäßig).

b. **Konfigurierbare Default-Bandauer** (z. B. 4 h für CrowdSec, 10 min für Fail2Ban) als Fallback: Wenn der letzte Ban älter ist als diese Dauer **und** `ip_summary.current_status !== 'banned'`, wird er ebenfalls als beendet markiert (`unbanned_at = banned_at + duration`, Grund: "abgelaufen").

c. **`current_status`-Override**: Nur der allerletzte offene Ban darf `active=true` bleiben, und auch nur, wenn `summary.current_status === 'banned'`. Sonst → beendet auf `summary.last_seen` (oder jetzt).

### 3. UI-Hinweis in `BanTimeline.tsx`
Tooltip/Label um den Grund erweitern: "aktiv", "beendet (Unban-Event)", "beendet (neuer Ban folgte)", "beendet (abgelaufen)". Damit ist optisch und semantisch sofort klar, *warum* der Ban als beendet gilt — auch wenn kein explizites Unban-Event existiert.

## Geänderte Dateien

- `src/lib/ipTimeline.ts` — `computeBanIntervals` erweitert, `BanInterval` bekommt Feld `end_reason: "unban" | "next_ban" | "expired" | "status_clean" | null`.
- `src/components/dashboard/BanTimeline.tsx` — Tooltip + visuelle Differenzierung der Endgründe (grüner Marker für echten Unban, gelber/grauer Marker für abgeleitet beendete Bans).
- `src/components/dashboard/IpDetailView.tsx` — `summary.current_status` und `summary.last_seen` an `buildIpTimelineBundle` durchreichen (Parameter-Erweiterung).
- `deploy/api/server.js` (optional, Diagnose) — Im `/api/ip/:ip/events`-Response auch die Anzahl `unbanning`-Events mitliefern und kurz loggen.
- `src/pages/Index.tsx` — Version auf **v0.8** anheben.

## Technische Details

`BanInterval` neu:
```ts
end_reason: "unban" | "next_ban" | "expired" | "status_clean" | null;
```

`buildIpTimelineBundle(ip, sec, auth, summary, enrichment, risk)` reicht `summary` an `computeBanIntervals(events, summary)` weiter. Die Heuristik wird *nur* angewendet, wenn die normale Unban-Paarung (a) kein Ergebnis bringt, damit echte Unban-Events Vorrang behalten.

Default-Bandauer-Konstanten:
```ts
const DEFAULT_BAN_DURATION_MS: Record<string, number> = {
  crowdsec: 4 * 60 * 60 * 1000,     // 4h
  netfilter: 10 * 60 * 1000,        // 10min (mailcow/fail2ban)
  default: 60 * 60 * 1000,          // 1h
};
```

## Deployment

```bash
cd /opt/dashboard && sudo git pull && cd deploy && \
sudo docker compose build api dashboard && \
sudo docker compose up -d api dashboard
```

Danach im Browser **Strg+Shift+R**.
