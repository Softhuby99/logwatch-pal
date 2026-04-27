import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import {
  Shield,
  ShieldOff,
  KeyRound,
  AlertTriangle,
  Globe,
  ExternalLink,
  Activity,
  Ban,
  Eye,
} from "lucide-react";
import { format } from "date-fns";
import { getIpTimeline, type IpTimelineEvent, type TimelineEventKind } from "@/lib/ipTimeline";
import BanTimeline from "./BanTimeline";
import IpActivityChart from "./IpActivityChart";
import type { AlertLevel, RiskLevel } from "@/types/database";

interface Props {
  ip: string;
  /** Wenn true: kompakt für Sheet. Wenn false: full-page. */
  embedded?: boolean;
}

const alertClass = (lvl: AlertLevel | null) => {
  if (lvl === "CRIT") return "bg-red-500/20 text-red-400 border-red-500/30";
  if (lvl === "WARN") return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  return "bg-muted text-muted-foreground border-border/30";
};

const riskClass = (lvl: RiskLevel) => {
  if (lvl === "CRIT") return "bg-red-600/30 text-red-300 border-red-600/40";
  if (lvl === "HIGH") return "bg-orange-500/20 text-orange-400 border-orange-500/30";
  if (lvl === "MEDIUM") return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
};

const KIND_META: Record<
  TimelineEventKind,
  { label: string; color: string; icon: typeof Shield; dot: string }
> = {
  ban: { label: "Ban", color: "text-red-400", dot: "bg-red-500", icon: Ban },
  unban: { label: "Unban", color: "text-emerald-400", dot: "bg-emerald-500", icon: ShieldOff },
  auth_failure: { label: "Auth Failure", color: "text-amber-400", dot: "bg-amber-500", icon: KeyRound },
  auth_success: { label: "Auth Success", color: "text-emerald-400", dot: "bg-emerald-500", icon: KeyRound },
  crowdsec: { label: "CrowdSec", color: "text-blue-400", dot: "bg-blue-500", icon: Eye },
  security_event: { label: "Security Event", color: "text-orange-400", dot: "bg-orange-500", icon: AlertTriangle },
};

const fmt = (iso: string) => {
  try { return format(new Date(iso), "yyyy-MM-dd HH:mm:ss"); } catch { return iso; }
};

const fmtShort = (iso: string) => {
  try { return format(new Date(iso), "dd.MM HH:mm"); } catch { return iso; }
};

const StatTile = ({ label, value, accent }: { label: string; value: number | string; accent?: string }) => (
  <div className="border border-border/30 rounded p-2 bg-card/40">
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className={`text-lg font-semibold font-mono ${accent ?? "text-foreground"}`}>{value}</div>
  </div>
);

const TimelineRow = ({ ev }: { ev: IpTimelineEvent }) => {
  const meta = KIND_META[ev.kind];
  const Icon = meta.icon;
  return (
    <div className="relative pl-6 pb-3 group">
      {/* Vertical line */}
      <div className="absolute left-[7px] top-2 bottom-0 w-px bg-border/40 group-last:hidden" />
      {/* Dot */}
      <div className={`absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full ${meta.dot} ring-2 ring-background flex items-center justify-center`}>
        <Icon className="h-2 w-2 text-background" />
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
            <Badge variant="outline" className={`text-[10px] px-1.5 font-mono ${alertClass(ev.alert_level)}`}>
              {ev.alert_level}
            </Badge>
            <span className="text-[10px] font-mono text-muted-foreground">
              {ev.source_system}{ev.source_component ? ` · ${ev.source_component}` : ""}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground ml-auto">{fmt(ev.event_time)}</span>
          </div>
          <div className="mt-1 text-xs text-foreground/90 font-mono">{ev.type_label}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground font-mono break-all">{ev.message}</div>
          <div className="mt-1 flex items-center gap-3 flex-wrap text-[10px] text-muted-foreground font-mono">
            {ev.username && <span>user: <span className="text-foreground/80">{ev.username}</span></span>}
            {ev.target_email && <span>target: <span className="text-foreground/80">{ev.target_email}</span></span>}
            {ev.destination_port && (
              <span>port: <span className="text-foreground/80">{ev.destination_port}/{ev.destination_service ?? "?"}</span></span>
            )}
            {ev.scenario_name && <span>scenario: <span className="text-foreground/80">{ev.scenario_name}</span></span>}
            {ev.request_path && (
              <span>{ev.http_method} <span className="text-foreground/80">{ev.request_path}</span> {ev.http_status}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const IpDetailView = ({ ip, embedded = false }: Props) => {
  const data = useMemo(() => getIpTimeline(ip), [ip]);
  const { summary, enrichment, risk, events, stats, by_type, ban_intervals } = data;

  return (
    <div className={embedded ? "space-y-4" : "space-y-6"}>
      {/* Header */}
      <div className="border border-border/40 rounded bg-card/60 backdrop-blur p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Shield className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-mono font-semibold text-foreground">{ip}</h2>
              {summary && (
                <Badge variant="outline" className={`text-[10px] px-1.5 font-mono ${
                  summary.current_status === "banned"
                    ? "bg-red-500/20 text-red-400 border-red-500/30"
                    : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                }`}>
                  {summary.current_status}
                </Badge>
              )}
              {risk && (
                <Badge variant="outline" className={`text-[10px] px-1.5 font-mono ${riskClass(risk.risk_level)}`}>
                  RISK {risk.score} · {risk.risk_level}
                </Badge>
              )}
            </div>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 text-xs font-mono text-muted-foreground">
              {enrichment?.country && <div><Globe className="inline h-3 w-3 mr-1" />{enrichment.country}</div>}
              {enrichment?.asn && <div>ASN: <span className="text-foreground/80">{enrichment.asn}</span></div>}
              {enrichment?.org_name && <div className="col-span-2 truncate">Org: <span className="text-foreground/80">{enrichment.org_name}</span></div>}
              {enrichment?.ptr && <div className="col-span-2 truncate">PTR: <span className="text-foreground/80">{enrichment.ptr}</span></div>}
              {stats.first_seen && <div>first: <span className="text-foreground/80">{fmt(stats.first_seen)}</span></div>}
              {stats.last_seen && <div>last: <span className="text-foreground/80">{fmt(stats.last_seen)}</span></div>}
            </div>
          </div>
          {embedded && (
            <button
              type="button"
              onClick={() => {
                const url = `/ip/${encodeURIComponent(ip)}`;
                const win = window.open(url, "_blank", "noopener");
                // Bring the new tab/window to the foreground
                if (win) {
                  try { win.focus(); } catch { /* noop */ }
                }
              }}
              className="text-xs text-primary hover:underline flex items-center gap-1 whitespace-nowrap"
            >
              <ExternalLink className="h-3 w-3" /> Volle Ansicht
            </button>
          )}
        </div>
      </div>

      {/* Stats Tiles */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <StatTile label="Total" value={stats.total} />
        <StatTile label="Bans" value={stats.bans} accent="text-red-400" />
        <StatTile label="Unbans" value={stats.unbans} accent="text-emerald-400" />
        <StatTile label="Auth Fail" value={stats.auth_failures} accent="text-amber-400" />
        <StatTile label="CrowdSec" value={stats.crowdsec} accent="text-blue-400" />
        <StatTile label="Andere" value={stats.other} accent="text-orange-400" />
      </div>

      {/* Ban-Historie (eigene Zeitlinie) */}
      <BanTimeline intervals={ban_intervals} compact={embedded} />

      {/* Aktivität (24h / 7T / 30T / 90T / einzelnes Datum) */}
      <IpActivityChart events={events} />

      {/* Top Reasons Bar Chart */}
      {by_type.length > 0 && (
        <div className="border border-border/40 rounded bg-card/60 p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground tracking-wide">Häufigste Angriffsgründe</span>
          </div>
          <div className="h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={by_type.slice(0, 8)} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 32% 17%)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} allowDecimals={false} />
                <YAxis dataKey="type" type="category" tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} width={140} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 4, fontSize: 11 }}
                />
                <Bar dataKey="count" fill="hsl(217 91% 60%)" radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Vertical Timeline */}
      <div className="border border-border/40 rounded bg-card/60">
        <div className="px-3 py-2 border-b border-border/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground tracking-wide">
              Event-Timeline ({events.length} Ereignisse)
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            {(["ban", "unban", "auth_failure", "crowdsec", "security_event"] as TimelineEventKind[]).map((k) => (
              <div key={k} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${KIND_META[k].dot}`} />
                <span>{KIND_META[k].label}</span>
              </div>
            ))}
          </div>
        </div>
        <ScrollArea className={embedded ? "h-[400px]" : "h-[600px]"}>
          <div className="p-4">
            {events.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground py-8">
                Keine Events für diese IP gefunden
              </div>
            ) : (
              events.map((ev) => <TimelineRow key={ev.id} ev={ev} />)
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default IpDetailView;
