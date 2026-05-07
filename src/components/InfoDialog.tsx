import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Info } from "lucide-react";

export const InfoDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-3xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Info className="h-4 w-4" /> Info & Glossar
        </DialogTitle>
        <DialogDescription>
          Erklärungen zu den Dashboard-Begriffen, Datenquellen und der
          Gesamtarchitektur.
        </DialogDescription>
      </DialogHeader>

      <ScrollArea className="max-h-[70vh] pr-3">
        <Accordion type="multiple" className="w-full">
          <AccordionItem value="sec-events">
            <AccordionTrigger>Was sind Security Events?</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground space-y-2">
              <p>
                Security Events sind alle sicherheitsrelevanten Ereignisse,
                die der LogCollector aus den angeschlossenen Systemen
                normalisiert in die Tabelle{" "}
                <code className="text-xs">security_events</code> schreibt.
              </p>
              <p>Quellen:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <b>OPNsense / CrowdSec</b> – HTTP-Scanner, WAF-Treffer,
                  Bot-Aktivität
                </li>
                <li>
                  <b>Mailcow / Postfix / Dovecot</b> – fehlgeschlagene
                  Auth-Versuche, Brute-Force
                </li>
                <li>
                  <b>Fail2ban</b> – Bann-Aktionen (banning / unbanning)
                </li>
                <li>
                  <b>Nginx / Reverse Proxy</b> – verdächtige Requests (4xx/5xx
                  Muster)
                </li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="banned">
            <AccordionTrigger>
              Was sind gebannte IPs &amp; woher kommen sie?
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground space-y-2">
              <p>
                Eine IP gilt als „banned“, wenn das Feld{" "}
                <code className="text-xs">current_status = 'banned'</code> in
                der Tabelle <code className="text-xs">ip_summary</code> steht.
                Ausgelöst wird das durch:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <b>Fail2ban</b> – jails wie postfix-sasl, dovecot,
                  nginx-botsearch
                </li>
                <li>
                  <b>CrowdSec</b> – Scenarios (z.B. http-crawl-non_statics,
                  ssh-bf)
                </li>
                <li>
                  <b>OPNsense Bouncer</b> – verteilt Decisions an die
                  Firewall
                </li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="ban-time">
            <AccordionTrigger>Was sind die Bann-Zeiten?</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground space-y-2">
              <p>
                Die Bann-Zeit ist die Dauer, für die eine IP gesperrt bleibt.
                Sie wird vom auslösenden System bestimmt:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <b>Fail2ban</b>: Standard 10 min, mit{" "}
                  <code className="text-xs">bantime.increment</code> bis zu
                  Tagen/Wochen bei Wiederholtätern
                </li>
                <li>
                  <b>CrowdSec</b>: Standard 4 Stunden pro Decision,
                  Scenario-abhängig
                </li>
                <li>
                  <b>Manuelle Bans</b>: dauerhaft bis aktiv entfernt
                </li>
              </ul>
              <p>
                Im Dashboard zeigt die <i>Ban History</i> alle Banning- und
                Unbanning-Events pro IP mit Zeitstempel.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="auth-fail">
            <AccordionTrigger>
              Was sind Auth Failures &amp; woher kommen sie?
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground space-y-2">
              <p>
                Alle fehlgeschlagenen Authentifizierungs-Versuche aus der
                Tabelle <code className="text-xs">auth_events</code> mit{" "}
                <code className="text-xs">auth_status = 'failed'</code>.
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <b>Postfix (SMTP-AUTH/SASL)</b> – Mailversand-Versuche
                </li>
                <li>
                  <b>Dovecot (IMAP/POP3)</b> – Mail-Abruf-Versuche
                </li>
                <li>
                  <b>Mailcow SOGo / Webmail</b> – Web-Login-Versuche
                </li>
                <li>
                  <b>SSH</b> – sofern entsprechende Logs eingespeist sind
                </li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="cs-alerts">
            <AccordionTrigger>
              Was sind CrowdSec Alerts &amp; woher kommen sie?
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground space-y-2">
              <p>
                CrowdSec analysiert Logs nach <i>Scenarios</i> (z.B.
                http-crawl-non_statics, http-bad-user-agent) und erzeugt
                Alerts, die im LogCollector als Security Events mit{" "}
                <code className="text-xs">source_system = 'opnsense'</code>{" "}
                und gesetztem <code className="text-xs">scenario_name</code>{" "}
                landen.
              </p>
              <p>
                Quelle: CrowdSec-Agent auf der OPNsense, der u.a. nginx-,
                Mailcow- und Firewall-Logs auswertet.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="risk">
            <AccordionTrigger>
              Wie wird der Risk Score berechnet?
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground space-y-2">
              <p>
                Der Risk Score (Tabelle{" "}
                <code className="text-xs">ip_risk_score</code>) ist ein
                gewichteter Score pro IP, der sich aus mehreren Faktoren
                speist:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Anzahl Auth-Failures (Brute-Force-Verhalten)</li>
                <li>Anzahl Bans &amp; Wiederholtäter-Faktor</li>
                <li>CrowdSec-Scenario-Treffer (gewichtet nach Schwere)</li>
                <li>Aktivität über Zeit (Decay für alte Events)</li>
                <li>GeoIP-/ASN-Reputation (bekannte Hoster, VPN, TOR)</li>
              </ul>
              <p>
                Daraus ergibt sich ein <code className="text-xs">score</code>{" "}
                (0–100) und eine{" "}
                <code className="text-xs">risk_level</code>-Einstufung
                (LOW / MEDIUM / HIGH / CRITICAL). In den Top-Angreifer-Tabellen
                wird primär nach Score sortiert.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="arch">
            <AccordionTrigger>Gesamtarchitektur</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground space-y-2">
              <pre className="text-[11px] leading-snug bg-muted/30 p-3 rounded-md overflow-x-auto">
{`  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
  │  Mailcow    │   │  OPNsense   │   │  Fail2ban   │
  │ Postfix/    │   │  + CrowdSec │   │  Jails      │
  │ Dovecot/    │   │             │   │             │
  │ nginx       │   │             │   │             │
  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
         │ syslog/         │ API/log         │ logs
         ▼                 ▼                 ▼
        ┌───────────────────────────────────────┐
        │   LogCollector (Python)               │
        │   - Parser (pro Quelle)               │
        │   - Normalizer                        │
        │   - Enricher (GeoIP/ASN)              │
        │   - Risk-Scorer                       │
        └──────────────┬────────────────────────┘
                       ▼
              ┌─────────────────┐
              │  MariaDB logdb  │
              │  - security_    │
              │    events       │
              │  - auth_events  │
              │  - ip_summary   │
              │  - ip_enrich-   │
              │    ment         │
              │  - ip_risk_     │
              │    score        │
              └────────┬────────┘
                       ▼
              ┌─────────────────┐
              │  Dashboard API  │
              │  (Express)      │
              └────────┬────────┘
                       ▼
              ┌─────────────────┐
              │  React UI       │
              │  (dieses        │
              │   Dashboard)    │
              └─────────────────┘`}
              </pre>
              <p>
                Der LogCollector schreibt normalisierte Events nach MariaDB.
                Periodische Jobs (IP-Enricher, Risk-Score, IP-Summary) lassen
                sich unter <i>Tools</i> manuell anstoßen. Das Dashboard liest
                ausschließlich aus der Express-API – keine Direktverbindung
                zur Datenbank.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="more">
            <AccordionTrigger>Weitere sinnvolle Themen</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground space-y-2">
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <b>IP-Scope</b>: intern / external / whitelisted –
                  bestimmt, ob eine IP in den Top-Angreifern auftaucht.
                </li>
                <li>
                  <b>Whitelisting</b>: eigene IPs, Monitoring, bekannte
                  Partner sollten in <code className="text-xs">ip_enrichment.ip_scope</code>
                  als <i>internal</i>/<i>whitelisted</i> markiert werden.
                </li>
                <li>
                  <b>Datenrückstand</b>: „??“ in der Länderspalte heißt, dass
                  der IP-Enricher die IP noch nicht aufgelöst hat – über
                  Tools manuell anstoßen.
                </li>
                <li>
                  <b>Demo vs. Live</b>: Wenn die API nicht erreichbar ist,
                  fällt das Dashboard auf Mock-Daten zurück (Badge „DEMO“).
                </li>
                <li>
                  <b>Refresh-Rate</b>: global einstellbar unter Tools –
                  niedrige Werte erhöhen die DB-Last.
                </li>
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </ScrollArea>
    </DialogContent>
  </Dialog>
);

export default InfoDialog;
