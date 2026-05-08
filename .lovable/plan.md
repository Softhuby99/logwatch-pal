# Reparaturplan für die leeren Ansichten

## Ziel
Die drei Fehlerbilder werden systematisch behoben und jeweils mit echten API-Antworten verifiziert:
1. **Auth Failures – Letzte 24h** bleibt leer
2. **Top aggressive external IPs (30 Days)** bleibt leer
3. **IP-Detail-Historie** zeigt für `80.187.83.199` keine Aktivität, obwohl `ip_summary` Events meldet

## Vorgehen

### 1) Deployment- und Versionskonsistenz absichern
- Die API liefert im Code bereits `0.6.3-auth-debug`, auf deinem Server lief aber zuletzt `0.6.0-integrations`.
- Ich baue deshalb zuerst eine klare Versionskontrolle ein bzw. nutze sie konsequent, damit wir sofort sehen, ob wirklich der neue API-Container aktiv ist.
- Außerdem prüfe ich die betroffenen Endpunkte direkt statt nur die Oberfläche.

**Abnahme:**
- `/api/version` zeigt die neue Version
- `/api/auth-debug` ist erreichbar
- die betroffenen API-Routen liefern JSON statt HTML oder alte Responses

### 2) Auth-Timeline datenbasiert reparieren
- Ich prüfe die echten Werte aus `auth_events` über den Debug-Endpunkt und gleiche den Filter für Fehlanmeldungen darauf ab.
- Danach passe ich die Klassifizierung für SMTP / IMAP / Sonstige so an, dass sie zu deinen realen `login_type`- und Fehlerwerten passt.
- Zusätzlich sorge ich dafür, dass die Timeline bei den letzten 24 Stunden auch konsistente Stunden-Buckets liefert, statt nur vorhandene Treffer zurückzugeben.

**Abnahme:**
- `/api/auth-debug` zeigt Treffer in den letzten 24h und die tatsächlich verwendeten Werte
- `/api/auth-timeline` liefert Datensätze mit `smtp`, `imap`, `other`
- die Kachel **Auth Failures – Letzte 24h** zeigt wieder echte Daten
- Drilldown `/api/auth-events/by-hour` funktioniert weiter mit denselben Filtern

### 3) Aggressive-IPs-Ansicht robust gegen leere/veraltete Views machen
- Aktuell hängt die Route komplett an `vw_top_aggressive_external_ips_30d_v3`.
- Ich baue einen Fallback ein: wenn die View leer ist oder auf dem Zielsystem nicht brauchbar liefert, wird direkt aus `ip_summary` + `ip_enrichment` + `ip_risk_score` abgefragt.
- So bleibt die Liste befüllt, auch wenn die View auf der VM abweicht oder veraltet ist.

**Abnahme:**
- `/api/aggressive-ips-30d` liefert wieder Einträge
- die Kachel **Top aggressive external IPs (30 Days)** ist nicht mehr leer
- Sortierung nach Risiko/Treffern bleibt erhalten

### 4) IP-Detail-Historie von Roh-Events entkoppeln
- Im aktuellen Code baut die Aktivitätsgrafik ihre Daten nur aus `/api/ip/:ip/events` auf.
- Für `80.187.83.199` ist aber sehr wahrscheinlich genau das Problem: `ip_summary` kennt die 12 Events, die Detailtabellen `security_events` und `auth_events` liefern sie aber nicht vollständig.
- Ich stelle die IP-Detailansicht daher auf einen robusteren Datenpfad um:
  - Detail-Timeline weiterhin aus Roh-Events, wenn vorhanden
  - Tageshistorie zusätzlich aus `/api/ip/:ip/daily` bzw. `ip_daily_summary`
  - Fallback, wenn Roh-Events leer sind, aber Tagesaggregate oder Summary vorhanden sind
- Damit wird die Grafik **Aktivität · letzte 30 Tage · täglich** nicht mehr leer, nur weil die Roh-Events in anderen Tabellen oder nur aggregiert vorliegen.

**Abnahme:**
- `/api/ip/80.187.83.199` zeigt Summary-Daten
- `/api/ip/80.187.83.199/events` und `/api/ip/80.187.83.199/daily` werden gegeneinander geprüft
- die Aktivitätsgrafik zeigt für `80.187.83.199` wieder Tageswerte statt leer zu bleiben

### 5) Gezielte End-to-End-Verifikation statt weiterem Probieren
Nach den Änderungen prüfe ich die Fehler nicht nur im Code, sondern über feste Kontrollpunkte:
- `/api/version`
- `/api/auth-debug`
- `/api/auth-timeline`
- `/api/aggressive-ips-30d`
- `/api/ip/80.187.83.199`
- `/api/ip/80.187.83.199/events`
- `/api/ip/80.187.83.199/daily`

Danach prüfe ich die drei betroffenen UI-Bereiche im Dashboard noch einmal gezielt.

## Technische Details
```text
Problemklasse A: API-Container auf VM läuft nicht auf dem erwarteten Code-Stand
Problemklasse B: Auth-Filter / Stundenaggregation passt nicht zu realen auth_events
Problemklasse C: Aggressive-IP-Liste hängt an einer fragilen DB-View
Problemklasse D: IP-Aktivitätschart nutzt nur Roh-Events statt vorhandene Tagesaggregate
```

## Ergebnis nach Umsetzung
- keine weitere Trial-and-Error-Schleife
- jede leere Ansicht bekommt einen klaren Datenpfad mit Fallback
- die betroffene IP `80.187.83.199` wird als Referenzfall für die Verifikation benutzt