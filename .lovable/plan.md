# Plan: Fehlende Länder-/Org-Daten im Backend beheben

## Ziel
Die `??`-Anzeige bei **Top Angreifer** soll nicht mehr durch fehlende Backend-Daten verursacht werden. Aktuell deutet alles darauf hin, dass für betroffene IPs **keine Datensätze in `ip_enrichment` existieren**.

## Was ich umsetzen würde

1. **Backend-Diagnose für Enrichment-Lücken ergänzen**
   - Im API-Backend einen kleinen Read-only-Check ergänzen, der für die aktuellen Top-IP-Adressen erkennt:
     - welche IPs in `ip_summary` vorhanden sind,
     - welche davon in `ip_enrichment` fehlen,
     - ob der manuelle `ip_enricher`-Job ausführbar ist.
   - Ziel: klar zwischen „UI ok, Daten fehlen“ und „Join/Schema defekt“ unterscheiden.

2. **API gegen Schema-Abweichungen absichern**
   - Die Doku zeigt Inkonsistenzen zwischen dokumentiertem Schema und laufendem Backend (z. B. `src_ip` in der Doku vs. `ip` im API-Code, außerdem unterschiedliche Feldnamen bei Enrichment-Spalten).
   - Ich würde die API robuster machen, damit sie mit den realen Spalten der Live-DB arbeitet bzw. im Fehlerfall sauber diagnostiziert statt still `??` zu liefern.
   - Fokus auf die Queries für:
     - `/api/top-attackers`
     - angrenzende Endpunkte mit `ip_enrichment`-Join

3. **Betriebsweg für das eigentliche Nachladen schärfen**
   - Den vorhandenen Tool-Flow (`/api/tools/run` mit `ip_enricher`) gezielt für diesen Fall nutzbar machen:
     - bessere Rückmeldung, wenn der Collector-Pfad / Python-Interpreter / Modulpfad nicht stimmt,
     - klar erkennbar, ob der Job erfolgreich lief,
     - Hinweis, dass nach Enrichment ggf. `daily_summary` und `risk_engine` erneut laufen sollten.

4. **Validierung**
   - Prüfen, dass die betroffenen IPs nach dem Lauf des Jobs in `ip_enrichment` auftauchen.
   - Danach verifizieren, dass `/api/top-attackers` für diese IPs `country` und `org_name` liefert.
   - Erwartetes Ergebnis im UI: statt `??` z. B. Flagge + ISO3-Code.

## Erwartetes Ergebnis
- Die Ursache ist im Backend transparent nachvollziehbar.
- Fehlende Enrichment-Daten können gezielt nachgeladen werden.
- Die API reagiert robuster auf Schema-Unterschiede zwischen Doku, Collector und Live-DB.
- Die Anzeige in **Top Angreifer** wird wieder korrekt mit Länder-/Org-Daten versorgt.

## Technische Details
- Relevanter API-Code sitzt in `deploy/api/server.js`.
- Aktuelle Query für Top-Angreifer joint bereits `ip_summary` mit `ip_enrichment`, aber die DB liefert für die betroffenen IPs offenbar keine Enrichment-Zeilen.
- Die vorhandene Tool-Infrastruktur (`ip_enricher`, `daily_summary`, `risk_engine`) ist bereits da und sollte der primäre Backend-Fixpfad sein.
- Dokumentation und Code verwenden teils unterschiedliche Schema-Begriffe; das ist ein zusätzlicher Risikofaktor und sollte im Backend abgefangen werden.