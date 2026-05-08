# Ziel
Die leeren Ansichten und der 502-Fehler werden nicht weiter per Trial-and-Error behandelt, sondern in einer festen Reihenfolge: erst Deployment-Stand korrigieren, dann die 3 betroffenen Datenpfade absichern, danach gezielt validieren.

# Was ich konkret umsetzen werde
1. **Deployment-Stand eindeutig machen**
   - Sicherstellen, dass API und Dashboard dieselbe aktuelle Version ausliefern.
   - Einen klaren Prüfschritt einbauen, damit sofort sichtbar ist, ob auf dem Zielsystem noch ein altes Image läuft.
   - Den 502-Pfad mit einer robusteren Start-/Health-Prüfung absichern, damit Nginx nicht gegen einen veralteten oder nicht sauber gestarteten Upstream läuft.

2. **`/api/auth-timeline` datenfest machen**
   - Die Failure-Erkennung für `auth_events` an echte Daten angleichen, statt nur auf die bisherigen String-Muster zu vertrauen.
   - Die 24h-Ansicht weiterhin lückenlos mit 24 Buckets liefern, auch wenn nur wenige oder anders normalisierte Events vorhanden sind.
   - Falls keine Auth-Fehler existieren, soll die Route sauber `[]`/Nullwerte liefern statt einen irreführenden Zwischenzustand.

3. **`/api/aggressive-ips-30d` stabilisieren**
   - Den bestehenden Fallback nicht nur bei SQL-Fehlern, sondern auch bei unbrauchbaren/teilweisen View-Ergebnissen robust machen.
   - Sicherstellen, dass die Liste aus `ip_summary`/Enrichment/Risk zuverlässig befüllt wird, wenn die Spezial-View leer oder inkonsistent ist.

4. **IP-Aktivitätschart für `80.187.83.199` korrigieren**
   - Die Chart-Logik so erweitern, dass nicht nur Auth-Fehler, sondern auch **Auth-Erfolge** als Aktivität sichtbar werden.
   - Dadurch erscheinen IPs mit echten Login-Events in „Aktivität · letzte 30 Tage · täglich“, auch wenn keine Security-Events oder Bans vorliegen.
   - Die Event-Timeline bleibt dabei getrennt und korrekt klassifiziert.

5. **Graceful Degradation für API-Antworten**
   - Kritische Dashboard-Endpunkte so härten, dass sie bei Teilfehlern strukturierte JSON-Antworten statt 500/Crash-Verhalten liefern.
   - Ziel: Frontend bleibt nutzbar, auch wenn eine Quelle leer ist oder eine View auf dem Server fehlt.

6. **Gezielte End-to-End-Validierung**
   - Nach der Umsetzung überprüfe ich genau diese Endpunkte:
     - `/api/version`
     - `/api/auth-debug`
     - `/api/auth-timeline`
     - `/api/aggressive-ips-30d`
     - `/api/ip/80.187.83.199`
     - `/api/ip/80.187.83.199/events`
   - Erwartung:
     - Version ist aktuell
     - `auth-debug` existiert
     - Auth-Timeline liefert valide Buckets
     - aggressive IPs sind nicht leer
     - die IP-Aktivität zeigt die vorhandenen 12 Success-Events sichtbar an

# Technische Details
- **Bereits bestätigt:** Im Code ist `API_VERSION = "0.6.4-fixes"` und die Route `/api/auth-debug` existiert bereits. Dass dein Server `0.6.0-integrations` meldet, ist ein klarer Hinweis auf **altes laufendes Deployment**, nicht auf fehlende Route im aktuellen Code.
- **Warum die IP-Historie leer bleibt:** Die aktuelle Chart-Klassifikation zählt `auth_success` nicht als Aktivitätsspur. Für eine IP mit 12 erfolgreichen IMAP-Logins gibt es deshalb faktisch sichtbare Events in der Timeline, aber keine Kurve im Aktivitätschart.
- **Warum 502 zusätzlich auftritt:** Das ist sehr wahrscheinlich ein Proxy/Upstream-Thema auf dem Zielsystem, nicht dieselbe Ursache wie die leeren Widgets. Ich behandle deshalb API-Version und Proxy-Erreichbarkeit getrennt.

# Ergebnis nach Umsetzung
Du bekommst eine reproduzierbare Kette statt weiterer Blindversuche:
- aktuelles Deployment nachweisbar aktiv
- keine leeren Kernwidgets trotz View-/Datenunterschieden
- sichtbare Aktivität für IPs mit Login-Erfolgen
- 502 sauber auf Upstream/Proxy eingegrenzt und abgesichert