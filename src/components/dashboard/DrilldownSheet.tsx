import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ChevronRight, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useIpDetail } from "@/contexts/IpDetailContext";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || "/api";

interface IpRow {
  ip: string;
  count: number;
  last_seen: string;
  login_types?: string[];
  users?: string[];
  types?: string[];
}

interface EventRow {
  id?: number | string;
  ip?: string;
  event_time?: string;
  event_type?: string;
  message?: string;
  username?: string;
  login_type?: string;
  source_component?: string;
  source_system?: string;
  auth_status?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  subtitle?: string;
  endpoint: string | null; // e.g. "/auth-events/by-hour?hour=12:00"
}

const fmtTime = (iso?: string) => {
  if (!iso) return "";
  try {
    return format(new Date(iso), "dd.MM. HH:mm:ss");
  } catch {
    return String(iso);
  }
};

export const DrilldownSheet = ({ open, onOpenChange, title, subtitle, endpoint }: Props) => {
  const { openIp } = useIpDetail();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ events: EventRow[]; by_ip: IpRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !endpoint) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    fetch(`${API_BASE}${endpoint}`, { cache: "no-store" })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(j => { if (!cancelled) setData(j); })
      .catch(e => { if (!cancelled) setError(e.message || String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, endpoint]);

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
            {title}
          </SheetTitle>
          {subtitle && (
            <div className="text-xs text-foreground font-mono">{subtitle}</div>
          )}
        </SheetHeader>

        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Lade Daten…
          </div>
        )}
        {error && (
          <div className="border border-destructive/40 rounded p-3 text-xs text-destructive font-mono">
            Fehler: {error}
          </div>
        )}
        {!loading && !error && data && (
          <>
            <div className="text-[11px] text-muted-foreground font-mono mb-3">
              {data.events.length} Event{data.events.length === 1 ? "" : "s"} · {data.by_ip.length} IP
              {data.by_ip.length === 1 ? "" : "s"}
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

              <TabsContent value="ips" className="mt-3">
                <ScrollArea className="h-[60vh] pr-2">
                  <div className="space-y-1.5">
                    {data.by_ip.length === 0 && (
                      <div className="text-xs text-muted-foreground font-mono p-4 text-center border border-border/30 rounded">
                        Keine IPs in diesem Zeitraum.
                      </div>
                    )}
                    {data.by_ip.map(row => (
                      <button
                        key={row.ip}
                        onClick={() => handleIpClick(row.ip)}
                        className="w-full text-left border border-border/30 rounded p-2.5 bg-card/40 hover:bg-card/70 hover:border-primary/40 transition-colors group"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-mono text-xs text-primary group-hover:underline truncate">
                            {row.ip}
                          </span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[11px] font-mono text-foreground">{row.count} Ev.</span>
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
                          </div>
                        </div>
                        <div className="mt-1 flex items-center gap-2 flex-wrap text-[10px] font-mono text-muted-foreground">
                          {(row.login_types || row.types || []).map(t => (
                            <Badge key={t} variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                              {t}
                            </Badge>
                          ))}
                          {row.users && row.users.length > 0 && (
                            <span className="truncate max-w-[200px]">user: {row.users.join(", ")}</span>
                          )}
                          <span className="ml-auto">letzte: {fmtTime(row.last_seen)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="events" className="mt-3">
                <ScrollArea className="h-[60vh] pr-2">
                  <div className="space-y-2">
                    {data.events.length === 0 && (
                      <div className="text-xs text-muted-foreground font-mono p-4 text-center border border-border/30 rounded">
                        Keine Events.
                      </div>
                    )}
                    {data.events.map((ev, i) => (
                      <div
                        key={ev.id ?? i}
                        className="border border-border/30 rounded p-2.5 bg-card/40"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          {ev.event_type && (
                            <Badge variant="outline" className="text-[10px] px-1.5 font-mono">
                              {ev.event_type}
                            </Badge>
                          )}
                          {ev.login_type && (
                            <Badge variant="outline" className="text-[10px] px-1.5 font-mono">
                              {ev.login_type}
                            </Badge>
                          )}
                          {ev.ip && (
                            <button
                              onClick={() => handleIpClick(ev.ip!)}
                              className="text-xs font-mono text-primary hover:underline"
                            >
                              {ev.ip}
                            </button>
                          )}
                          <span className="text-[10px] font-mono text-muted-foreground ml-auto">
                            {fmtTime(ev.event_time)}
                          </span>
                        </div>
                        {ev.message && (
                          <div className="mt-1 text-[11px] text-muted-foreground font-mono break-all">
                            {ev.message}
                          </div>
                        )}
                        <div className="mt-1 flex items-center gap-3 flex-wrap text-[10px] text-muted-foreground font-mono">
                          {(ev.source_system || ev.source_component) && (
                            <span>
                              {ev.source_system}
                              {ev.source_component ? ` · ${ev.source_component}` : ""}
                            </span>
                          )}
                          {ev.username && (
                            <span>user: <span className="text-foreground/80">{ev.username}</span></span>
                          )}
                          {ev.auth_status && (
                            <span>status: <span className="text-foreground/80">{ev.auth_status}</span></span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default DrilldownSheet;
