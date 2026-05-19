import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ChevronRight, Globe, Building2, Network, Loader2 } from "lucide-react";
import { fetchCountryDetail } from "@/lib/geoAttacks";
import { useApiData } from "@/hooks/useApiData";
import { useIpDetail } from "@/contexts/IpDetailContext";
import type { AlertLevel } from "@/types/database";

interface Props {
  iso2: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const alertClass = (lvl: AlertLevel | null) => {
  if (lvl === "CRIT") return "bg-red-500/20 text-red-400 border-red-500/30";
  if (lvl === "WARN") return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  return "bg-muted text-muted-foreground border-border/30";
};

const riskClass = (lvl: string) => {
  if (lvl === "CRIT") return "bg-red-600/30 text-red-300 border-red-600/40";
  if (lvl === "HIGH") return "bg-orange-500/20 text-orange-400 border-orange-500/30";
  if (lvl === "MEDIUM") return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
};

const countryFlag = (iso2: string) => {
  if (!iso2 || iso2.length !== 2) return "🌐";
  const codePoints = iso2
    .toUpperCase()
    .split("")
    .map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

const CountryDetailSheet = ({ iso2, open, onOpenChange }: Props) => {
  const { openIp } = useIpDetail();
  const { data, loading } = useApiData(
    () =>
      iso2
        ? fetchCountryDetail(iso2)
        : Promise.resolve({
            data: {
              iso2: "",
              iso3: null,
              name: "",
              ips: [],
              totals: { unique_ips: 0, total_events: 0, bans: 0, auth_failures: 0 },
            },
            live: false,
          }),
    [iso2, open],
  );

  const handleIpClick = (ip: string) => {
    onOpenChange(false);
    setTimeout(() => openIp(ip), 150);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl lg:max-w-3xl overflow-y-auto bg-background border-l border-border/50 p-4 sm:p-6"
      >
        <SheetHeader className="mb-4">
          <SheetTitle className="text-sm font-normal text-muted-foreground tracking-wide">
            Country · Drilldown
          </SheetTitle>
          {data && (
            <div className="flex items-center gap-2 text-foreground">
              <span className="text-2xl leading-none">{countryFlag(data.iso2)}</span>
              <div>
                <div className="text-base font-semibold">{data.name}</div>
                <div className="text-[10px] font-mono text-muted-foreground">
                  {data.iso2} · {data.iso3 ?? "—"}
                </div>
              </div>
            </div>
          )}
        </SheetHeader>

        {loading && (!data || data.ips.length === 0) ? (
          <div className="border border-border/30 rounded p-6 text-center text-xs text-muted-foreground font-mono flex items-center justify-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Lade IPs …
          </div>
        ) : !data || data.ips.length === 0 ? (
          <div className="border border-border/30 rounded p-6 text-center text-xs text-muted-foreground font-mono">
            Keine Angriffe aus diesem Land erfasst.
          </div>
        ) : (
          <>
            {/* Totals */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              <div className="border border-border/30 rounded p-2 bg-card/40">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">IPs</div>
                <div className="text-lg font-semibold font-mono text-foreground">
                  {data.totals.unique_ips}
                </div>
              </div>
              <div className="border border-border/30 rounded p-2 bg-card/40">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Events</div>
                <div className="text-lg font-semibold font-mono text-foreground">
                  {data.totals.total_events}
                </div>
              </div>
              <div className="border border-border/30 rounded p-2 bg-card/40">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Bans</div>
                <div className="text-lg font-semibold font-mono text-red-400">{data.totals.bans}</div>
              </div>
              <div className="border border-border/30 rounded p-2 bg-card/40">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Auth-Fail</div>
                <div className="text-lg font-semibold font-mono text-amber-400">
                  {data.totals.auth_failures}
                </div>
              </div>
            </div>

            <div className="text-[11px] text-muted-foreground font-mono mb-2 flex items-center gap-1.5">
              <Globe className="h-3 w-3" />
              IPs aus {data.name} ({data.ips.length})
            </div>

            <ScrollArea className="h-[60vh] pr-2">
              <div className="space-y-1.5">
                {data.ips.map((row) => (
                  <button
                    key={row.ip}
                    onClick={() => handleIpClick(row.ip)}
                    className="w-full text-left border border-border/30 rounded p-2.5 bg-card/40 hover:bg-card/70 hover:border-primary/40 transition-colors group"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-xs text-primary group-hover:underline truncate">
                          {row.ip}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 font-mono ${riskClass(row.risk_level)}`}
                        >
                          {row.risk_level} · {row.risk_score}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 font-mono ${alertClass(row.last_alert)}`}
                        >
                          {row.last_alert}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[11px] font-mono text-foreground">{row.events} Ev.</span>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
                      </div>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-[10px] font-mono text-muted-foreground flex-wrap">
                      {row.org_name && (
                        <span className="flex items-center gap-1 truncate max-w-[260px]">
                          <Building2 className="h-2.5 w-2.5" />
                          {row.org_name}
                        </span>
                      )}
                      {row.asn && (
                        <span className="flex items-center gap-1">
                          <Network className="h-2.5 w-2.5" />
                          {row.asn}
                        </span>
                      )}
                      {row.ptr && <span className="truncate max-w-[200px]">PTR: {row.ptr}</span>}
                    </div>
                    {(row.bans > 0 || row.auth_failures > 0) && (
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        {row.bans > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border border-red-500/30 bg-red-500/10 text-red-400">
                            Bans: {row.bans}
                          </span>
                        )}
                        {row.auth_failures > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-400">
                            Auth-Fail: {row.auth_failures}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>

            <Separator className="my-4 bg-border/30" />
            <div className="text-[10px] text-muted-foreground font-mono">
              Tipp: IP anklicken für vollständigen Drilldown (Verlauf, Bans, Risk-Score).
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default CountryDetailSheet;
