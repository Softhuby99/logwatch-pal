import { useMemo, useState } from "react";
import { Ban, ShieldOff, Clock, KeyRound, AlertTriangle, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import type { BanInterval, IpTimelineEvent, TimelineEventKind } from "@/lib/ipTimeline";

interface Props {
  intervals: BanInterval[];
  /** Compact = innerhalb Sheet, false = volle Höhe */
  compact?: boolean;
  /** Optional: Angriffs-Events, die als Marker unter der Ban-Achse gezeigt werden */
  events?: IpTimelineEvent[];
}

const ATTACK_KIND_META: Partial<Record<TimelineEventKind, { label: string; color: string; ring: string; icon: typeof KeyRound }>> = {
  auth_failure: { label: "Auth Failure", color: "bg-amber-500", ring: "ring-amber-400/40", icon: KeyRound },
  crowdsec: { label: "CrowdSec", color: "bg-blue-500", ring: "ring-blue-400/40", icon: Eye },
  security_event: { label: "Security Event", color: "bg-orange-500", ring: "ring-orange-400/40", icon: AlertTriangle },
};

const fmtFull = (iso: string) => {
  try {
    return format(new Date(iso), "dd.MM.yyyy HH:mm:ss");
  } catch {
    return iso;
  }
};

const fmtShort = (iso: string) => {
  try {
    return format(new Date(iso), "dd.MM HH:mm");
  } catch {
    return iso;
  }
};

const fmtDuration = (ms: number) => {
  if (ms < 1000) return "< 1s";
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}min`;
  if (ms < 86_400_000) {
    const h = Math.floor(ms / 3_600_000);
    const m = Math.round((ms % 3_600_000) / 60_000);
    return m ? `${h}h ${m}min` : `${h}h`;
  }
  const d = Math.floor(ms / 86_400_000);
  const h = Math.round((ms % 86_400_000) / 3_600_000);
  return h ? `${d}d ${h}h` : `${d}d`;
};

const BanTimeline = ({ intervals, compact = false, events = [] }: Props) => {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [hoverEvId, setHoverEvId] = useState<string | null>(null);

  // Skala: vom ältesten Ban bis "jetzt"
  const { minMs, maxMs, totalMs, validIntervals } = useMemo(() => {
    const valid = intervals.filter((i) => i.duration_ms > 0 || i.active);
    if (valid.length === 0) {
      return { minMs: Date.now(), maxMs: Date.now(), totalMs: 1, validIntervals: [] };
    }
    const starts = valid.map((i) => new Date(i.banned_at).getTime());
    const ends = valid.map((i) =>
      i.unbanned_at ? new Date(i.unbanned_at).getTime() : Date.now()
    );
    const min = Math.min(...starts);
    const max = Math.max(...ends, Date.now());
    // Padding 5% links/rechts
    const span = Math.max(max - min, 60_000);
    const pad = span * 0.04;
    return {
      minMs: min - pad,
      maxMs: max + pad,
      totalMs: span + 2 * pad,
      validIntervals: valid,
    };
  }, [intervals]);

  if (validIntervals.length === 0) {
    return (
      <div className="border border-border/40 rounded bg-card/60 p-4">
        <div className="flex items-center gap-2 mb-1">
          <Ban className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground tracking-wide">Ban-Historie</span>
        </div>
        <div className="text-xs text-muted-foreground py-3 text-center">
          Keine Ban-Events für diese IP.
        </div>
      </div>
    );
  }

  // Tick-Marken (5 gleichmäßig verteilt)
  const ticks = Array.from({ length: 5 }, (_, i) => minMs + (totalMs * i) / 4);
  const nowPct = ((Date.now() - minMs) / totalMs) * 100;

  const totalBannedMs = validIntervals.reduce((s, i) => s + i.duration_ms, 0);
  const activeCount = validIntervals.filter((i) => i.active).length;

  // Angriffs-Events innerhalb des sichtbaren Zeitfensters
  const attackEvents = useMemo(() => {
    return events
      .filter((e) => ATTACK_KIND_META[e.kind])
      .map((e) => ({ ev: e, t: new Date(e.event_time).getTime() }))
      .filter((x) => x.t >= minMs && x.t <= maxMs);
  }, [events, minMs, maxMs]);

  const attackCounts = useMemo(() => {
    const counts: Partial<Record<TimelineEventKind, number>> = {};
    for (const { ev } of attackEvents) counts[ev.kind] = (counts[ev.kind] ?? 0) + 1;
    return counts;
  }, [attackEvents]);

  return (
    <div className="border border-border/40 rounded bg-card/60">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border/30 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Ban className="h-3.5 w-3.5 text-red-400" />
          <span className="text-xs text-muted-foreground tracking-wide">
            Ban-Historie ({validIntervals.length}{" "}
            {validIntervals.length === 1 ? "Periode" : "Perioden"})
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />
            Gesamt geblockt: <span className="text-foreground">{fmtDuration(totalBannedMs)}</span>
          </span>
          {activeCount > 0 && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 font-mono bg-red-500/20 text-red-400 border-red-500/30"
            >
              {activeCount} aktiv
            </Badge>
          )}
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            Ban
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Unban
          </span>
          {Object.entries(ATTACK_KIND_META).map(([kind, meta]) =>
            meta && attackCounts[kind as TimelineEventKind] ? (
              <span key={kind} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${meta.color}`} />
                {meta.label}
                <span className="text-foreground/70">({attackCounts[kind as TimelineEventKind]})</span>
              </span>
            ) : null
          )}
        </div>
      </div>

      {/* Horizontal Timeline */}
      <div className="px-3 pt-4 pb-2">
        <div className="relative h-16">
          {/* Achse (oben für Bans, Mitte für Angriffe) */}
          <div className="absolute left-0 right-0 top-[28%] h-px bg-border/40" />

          {/* "Jetzt"-Marker */}
          {nowPct >= 0 && nowPct <= 100 && (
            <div
              className="absolute top-0 bottom-0 w-px bg-primary/60"
              style={{ left: `${nowPct}%` }}
              title="jetzt"
            >
              <span className="absolute -top-3 left-1 text-[9px] font-mono text-primary whitespace-nowrap">
                jetzt
              </span>
            </div>
          )}

          {/* Ban-Spans */}
          {validIntervals.map((iv) => {
            const startMs = new Date(iv.banned_at).getTime();
            const endMs = iv.unbanned_at ? new Date(iv.unbanned_at).getTime() : Date.now();
            const leftPct = ((startMs - minMs) / totalMs) * 100;
            const widthPct = Math.max(((endMs - startMs) / totalMs) * 100, 0.5);
            const isHover = hoverId === iv.id;

            return (
              <div
                key={iv.id}
                className="absolute top-[28%] -translate-y-1/2 group cursor-pointer"
                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                onMouseEnter={() => setHoverId(iv.id)}
                onMouseLeave={() => setHoverId(null)}
              >
                {/* Span-Bar */}
                <div
                  className={`h-4 rounded-sm border transition-all ${
                    iv.active
                      ? "bg-red-500/30 border-red-500/60 group-hover:bg-red-500/50"
                      : "bg-red-500/20 border-red-500/40 group-hover:bg-red-500/40"
                  } ${isHover ? "ring-1 ring-red-400" : ""}`}
                />
                {/* Start-Marker (Ban) */}
                <div
                  className="absolute -top-1 left-0 w-2 h-2 rounded-full bg-red-500 border border-background"
                  style={{ transform: "translateX(-50%)" }}
                />
                {/* End-Marker (Unban) wenn nicht aktiv */}
                {!iv.active && (
                  <div
                    className="absolute -top-1 right-0 w-2 h-2 rounded-full bg-emerald-500 border border-background"
                    style={{ transform: "translateX(50%)" }}
                  />
                )}

                {/* Tooltip */}
                {isHover && (
                  <div
                    className="absolute z-30 bg-popover border border-border/60 rounded px-2.5 py-1.5 shadow-lg text-[11px] font-mono whitespace-nowrap pointer-events-none"
                    style={{
                      bottom: "calc(100% + 8px)",
                      left: "50%",
                      transform: "translateX(-50%)",
                    }}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Ban className="h-3 w-3 text-red-400" />
                      <span className="text-foreground font-semibold">
                        {iv.active ? "Aktiver Ban" : "Ban-Periode"}
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-foreground">{fmtDuration(iv.duration_ms)}</span>
                    </div>
                    <div className="space-y-0.5 text-[10px]">
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Ban:</span>
                        <span className="text-red-400">{fmtFull(iv.banned_at)}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Unban:</span>
                        <span className={iv.active ? "text-amber-400" : "text-emerald-400"}>
                          {iv.unbanned_at ? fmtFull(iv.unbanned_at) : "— noch aktiv —"}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Quelle:</span>
                        <span className="text-foreground">
                          {iv.source_system}
                          {iv.source_component ? ` · ${iv.source_component}` : ""}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Grund:</span>
                        <span className="text-foreground/80 max-w-[260px] truncate">
                          {iv.reason}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Tick-Labels */}
        <div className="relative h-4 mt-1">
          {ticks.map((t, i) => (
            <div
              key={i}
              className="absolute top-0 -translate-x-1/2 text-[9px] font-mono text-muted-foreground"
              style={{ left: `${(i / (ticks.length - 1)) * 100}%` }}
            >
              {fmtShort(new Date(t).toISOString())}
            </div>
          ))}
        </div>
      </div>

      {/* Tabelle der Ban-Perioden */}
      <div className="border-t border-border/30">
        <ScrollArea className={compact ? "h-[180px]" : "h-[240px]"}>
          <table className="w-full text-[11px] font-mono">
            <thead className="sticky top-0 bg-card/95 backdrop-blur z-10">
              <tr className="border-b border-border/30 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-3 py-1.5">Status</th>
                <th className="text-left px-2 py-1.5">Ban</th>
                <th className="text-left px-2 py-1.5">Unban</th>
                <th className="text-right px-2 py-1.5">Dauer</th>
                <th className="text-left px-2 py-1.5">Quelle</th>
                <th className="text-left px-3 py-1.5">Grund</th>
              </tr>
            </thead>
            <tbody>
              {validIntervals.map((iv) => (
                <tr
                  key={iv.id}
                  className={`border-b border-border/20 hover:bg-muted/30 transition-colors ${
                    hoverId === iv.id ? "bg-muted/40" : ""
                  }`}
                  onMouseEnter={() => setHoverId(iv.id)}
                  onMouseLeave={() => setHoverId(null)}
                >
                  <td className="px-3 py-1.5">
                    {iv.active ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 font-mono bg-red-500/20 text-red-400 border-red-500/30"
                      >
                        <Ban className="h-2.5 w-2.5 mr-0.5" /> aktiv
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 font-mono bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      >
                        <ShieldOff className="h-2.5 w-2.5 mr-0.5" /> beendet
                      </Badge>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-red-400 whitespace-nowrap">
                    {fmtFull(iv.banned_at)}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    {iv.unbanned_at ? (
                      <span className="text-emerald-400">{fmtFull(iv.unbanned_at)}</span>
                    ) : (
                      <span className="text-muted-foreground italic">—</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right text-foreground">
                    {fmtDuration(iv.duration_ms)}
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground">
                    {iv.source_system}
                    {iv.source_component ? ` · ${iv.source_component}` : ""}
                  </td>
                  <td className="px-3 py-1.5 text-foreground/80 max-w-[280px] truncate">
                    {iv.reason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      </div>
    </div>
  );
};

export default BanTimeline;
