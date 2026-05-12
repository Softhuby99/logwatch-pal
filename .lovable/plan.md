## Ziel

In **Top Angreifer** zeigt die Spalte `land` statt `??`:

- **Externe IPs mit Enrichment** → Flagge + **ISO3-Code**, z. B. `🇩🇪 DEU`, `🇷🇺 RUS`
- **Private/interne IPs** (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8) → Badge `LAN`
- **Externe IP, kein Mapping** → ISO2 als Fallback (z. B. `XK`)
- **Keine Daten** → `??`

## Was passiert

1. **`src/components/dashboard/TopAttackersTabbed.tsx`**
   - Neue Helper `formatCountryCell(ip, iso2)` rendert die Zelle:
     - private/loopback → `<span className="text-muted-foreground">LAN</span>`
     - `iso2` vorhanden → `flag(iso2) + " " + (iso2ToIso3(iso2) ?? iso2)`
     - sonst → `??`
   - Zeile 258 ersetzt durch Aufruf des Helpers.
   - Filter/Sortierung weiter auf `row.country` (ISO2). Optional: `cellValue` für `country` so ändern, dass auch der ISO3-String matcht (Filter-UX).

2. **`src/data/mockSecurityData.ts`** (Mock)
   - Für die im Screenshot sichtbaren externen IPs ohne Enrichment Einträge in `mockIPEnrichment` ergänzen:
     `3.129.187.38` (US/AWS), `81.19.216.85` (RU), `89.21.67.184` (DE), `5.255.118.182` (RU), `80.187.82.22` (DE).
   - Damit ist die Anzeige sofort sichtbar, ohne auf echtes Backend zu warten.

3. **Tooltip mit Ländername** (auf Wunsch): `title={iso2ToName(iso2)}` bei der Zelle. Sage Bescheid, wenn dies enthalten sein soll – ansonsten weglassen.

4. **Keine** Änderung am API-Vertrag, am DB-Schema oder am Backend.

## Technische Details

- ISO3-Konvertierung: bestehender Helper `iso2ToIso3` aus `src/lib/geoAttacks.ts` (~36 Länder gemappt). Fallback bei Lücke = ISO2.
- Flag-Emoji aus ISO2 (ISO3 funktioniert nicht für Regional Indicators):
  ```ts
  const flag = (iso2: string) =>
    iso2.toUpperCase().replace(/./g, c =>
      String.fromCodePoint(127397 + c.charCodeAt(0))
    );
  ```
- Private-IP-Erkennung als kleine Funktion in der Komponente:
  ```ts
  const isPrivate = (ip: string) =>
    /^10\./.test(ip) ||
    /^192\.168\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    /^127\./.test(ip);
  ```
- Spalten-Layout: `inline-flex items-center gap-1 font-mono`.

## Verifikation nach Implementierung

- Build/Typecheck läuft (Lovable übernimmt).
- Visuell prüfen: 24h/7d/30d-Tabs zeigen für die o. g. IPs jetzt z. B. `🇺🇸 USA`, `🇷🇺 RUS`, `🇩🇪 DEU`; die `192.168.x` Zeilen zeigen `LAN`.

## Out of scope

- Erweiterung des `COUNTRY_TABLE` in `geoAttacks.ts` um alle 249 Länder (kann später, nur bei Bedarf).
- Backend-Job, der fehlende `ip_enrichment.country`-Werte über GeoIP nachfüllt (LogCollector-Seite, separates Repo).