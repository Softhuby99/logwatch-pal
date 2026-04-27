import { useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { format } from "date-fns";
import {
  Ban,
  ShieldOff,
  KeyRound,
  Eye,
  AlertTriangle,
  Shield,
  ChevronRight,
  Globe,
} from "lucide-react";
import { getBucketDetail } from "@/lib/ipTimeline";
import { useIpDetail } from "@/contexts/IpDetailContext";
import type { AlertLevel } from "@/types/database";

interface Props {
  bucketStart: string | null;
  bucketHours: number;
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

const KIND_ICON = {
  ban: { icon: Ban, color: "text-red-400", dot: "bg-red-500" },
  unban: { icon: ShieldOff, color: "text-emerald-400", dot: "bg-emerald-500" },
  auth_failure: { icon: KeyRound, color: "text-amber-400", dot: "bg-amber-500" },
  auth_success: { icon: KeyRound, color: "text-emerald-400", dot: "bg-emerald-500" },
  crowdsec: { icon: Eye, color: "text-blue-400", dot: "bg-blue-500" },
  security_event: { icon: AlertTriangle, color: "text-orange-400", dot: "bg-orange-500" },
} as const;

const CATEGORY_LABELS = {
  brute_force: { label: "Brute Force", color: "hsl(0 84% 60%)" },
  auth_failure: { label: "Auth Failure", color: "hsl(38 92% 50%)" },
  port_scan: { label: "Port Scan", color: "hsl(217 91% 60%)" },
  ban: { label: "Ban", color: "hsl(280 70% 55%)" },
  unban: { label: "Unban", color: "hsl(142 71% 45%)" },
  crawl_probe: { label: "Crawl/Probe", color: "hsl(160 60% 45%)" },
} as const;

const fmtRange = (startIso: string, endIso: string) => {
  try {
    const s = new Date(startIso);
    const e = new Date(endIso);
    return `${format(s, "dd.MM.yyyy HH:mm")} – ${format(e, "HH:mm")}`;
  } catch {
    return `${startIso} – ${endIso}`;
  }
};

const fmtTime = (iso: string) => {
  try {
    return format(new Date(iso), "HH:mm:ss");
  } catch {
    return iso;
  }
};

const BucketDetailSheet = ({ bucketStart, bucketHours, open, onOpenChange }: Props) => {
  const { openIp } = useIpDetail();
  const data = useMemo(
    () => (bucketStart ? getBucketDetail(bucketStart, bucketHours) : null),
    [bucketStart, bucketHours]
  );

  const handleIpClick = (ip: string) => {
    onOpenChange(false);
    // kleine Verzögerung damit das aktuelle Sheet schließt bevor das neue öffnet
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
            Zeitfenster · Drilldown
          </SheetTitle>
          {data && (
            <div className="text-xs text-foreground font-mono">
              {fmtRange(data.bucket_start, data.bucket_end)}
              <span className="ml-2 text-muted-foreground">
                · {data.events.length} Event{data.events.length === 1 ? "" : "s"} · {data.by_ip.length} IP
                {data.by_ip.length === 1 ? "" : "s"}
              </span>
            </div>
          )}
        </SheetHeader>

        {!data || data.events.length === 0 ? (
          <div className="border border-border/30 rounded p-6 text-center text-xs text-muted-foreground font-mono">
            Keine Events in diesem Zeitfenster.
          </div>
        ) : (
          <>
            {/* Kategorien-Übersicht */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
              {(Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>).map((k) => {
                const meta = CATEGORY_LABELS[k];
                const v = data.by_category[k];
                return (
                  <div
                    key={k}
                    className="border border-border/30 rounded p-2 bg-card/40"
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: meta.color }}
                      />
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">
                        {meta.label}
                      </span>
                    </div>
                    <div className="text-lg font-semibold font-mono text-foreground">{v}</div>
                  </div>
                );
              })}
            </div>

            <Tabs defaultValue="ips" className="w-full">
              <TabsList className="bg-card/40 border border-border/30 h-8">
                <TabsTrigger value="ips" className="text-xs h-6 px-3">
                  Top IPs ({data.by_ip.length})
                </TabsTrigger>
                <TabsTrigger value="events" className="text-xs h-6 px-3">
                  Events ({data.events.length})
                </TabsTrigger>
              </TabsList>

              {/* === Top IPs === */}
              <TabsContent value="ips" className="mt-3">
                <ScrollArea className="h-[55vh] pr-2">
                  <div className="space-y-1.5">
                    {data.by_ip.map((row) => (
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
                              className={`text-[10px] px-1.5 font-mono ${alertClass(row.last_alert_level)}`}
                            >
                              {row.last_alert_level}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[11px] font-mono text-foreground">
                              {row.count} Ev.
                            </span>
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
                          </div>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
                          {row.country && (
                            <span className="flex items-center gap-1">
                              <Globe className="h-2.5 w-2.5" />
                              {row.country}
                            </span>
                          )}
                          {row.org_name && (
                            <span className="truncate max-w-[200px]">{row.org_name}</span>
                          )}
                          <span className="ml-auto">letzte: {fmtTime(row.last_seen)}</span>
                        </div>
                        {/* Kategorien-Chips */}
                        <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                          {(Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>).map(
                            (k) => {
                              const v = row.categories[k];
                              if (!v) return null;
                              const meta = CATEGORY_LABELS[k];
                              return (
                                <span
                                  key={k}
                                  className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border border-border/30 bg-background/40"
                                >
                                  <span
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ background: meta.color }}
                                  />
                                  {meta.label}: {v}
                                </span>
                              );
                            }
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* === Events === */}
              <TabsContent value="events" className="mt-3">
                <ScrollArea className="h-[55vh] pr-2">
                  <div className="space-y-2">
                    {data.events.map((ev) => {
                      const meta = KIND_ICON[ev.kind];
                      const Icon = meta.icon;
                      // ip aus Original-Source ermitteln (id = "sec:1" o. "auth:5")
                      // wir nutzen target_email/username/etc. aus dem timeline event
                      return (
                        <div
                          key={ev.id}
                          className="border border-border/30 rounded p-2.5 bg-card/40"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`w-5 h-5 rounded-full ${meta.dot} flex items-center justify-center flex-shrink-0`}
                            >
                              <Icon className="h-3 w-3 text-background" />
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 font-mono ${alertClass(ev.alert_level)}`}
                            >
                              {ev.alert_level}
                            </Badge>
                            <span className="text-xs font-mono text-foreground">{ev.type_label}</span>
                            <span className="text-[10px] font-mono text-muted-foreground ml-auto">
                              {fmtTime(ev.event_time)}
                            </span>
                          </div>
                          <div className="mt-1 text-[11px] text-muted-foreground font-mono break-all">
                            {ev.message}
                          </div>
                          <div className="mt-1 flex items-center gap-3 flex-wrap text-[10px] text-muted-foreground font-mono">
                            <span>
                              {ev.source_system}
                              {ev.source_component ? ` · ${ev.source_component}` : ""}
                            </span>
                            {ev.username && (
                              <span>
                                user: <span className="text-foreground/80">{ev.username}</span>
                              </span>
                            )}
                            {ev.target_email && (
                              <span>
                                target: <span className="text-foreground/80">{ev.target_email}</span>
                              </span>
                            )}
                            {ev.destination_port && (
                              <span>
                                port:{" "}
                                <span className="text-foreground/80">
                                  {ev.destination_port}/{ev.destination_service ?? "?"}
                                </span>
                              </span>
                            )}
                            {ev.scenario_name && (
                              <span>
                                scenario: <span className="text-foreground/80">{ev.scenario_name}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>

            <Separator className="my-4 bg-border/30" />
            <div className="text-[10px] text-muted-foreground font-mono">
              Tipp: IP anklicken für vollständigen Drilldown (Verlauf, Bans, GeoIP, Risk).
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default BucketDetailSheet;
