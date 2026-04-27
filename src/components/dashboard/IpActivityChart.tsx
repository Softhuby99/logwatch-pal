import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Activity, CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { IpTimelineEvent } from "@/lib/ipTimeline";

type RangePreset = "24h" | "7d" | "30d" | "90d" | "day";

interface Props {
  events: IpTimelineEvent[];
}

interface ChartRow {
  /** Bucket-Start ISO (für Tooltip) */
  iso: string;
  /** Label für X-Achse */
  label: string;
  "Brute Force": number;
  "Auth Failures": number;
  "Port Scan": number;
  Bans: number;
  Unbans: number;
  "Crawl/Probe": number;
}

const PRESETS: Array<{ value: RangePreset; label: string }> = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7T" },
  { value: "30d", label: "30T" },
  { value: "90d", label: "90T" },
  { value: "day", label: "Datum" },
];

/** Klassifiziere Event in eine der 6 Angriffstypen-Spuren */
const classify = (
  ev: IpTimelineEvent
): keyof Omit<ChartRow, "iso" | "label"> | null => {
  if (ev.kind === "ban") return "Bans";
  if (ev.kind === "unban") return "Unbans";
  if (ev.kind === "auth_failure") {
    return ev.type_label?.toUpperCase().includes("BRUTE")
      ? "Brute Force"
      : "Auth Failures";
  }
  if (ev.kind === "crowdsec") {
    const t = (ev.type_label || "").toUpperCase();
    if (t.includes("PROBING") || t.includes("SCAN") || t.includes("PORT")) return "Port Scan";
    return "Crawl/Probe";
  }
  if (ev.kind === "security_event") {
    const t = (ev.type_label || "").toUpperCase();
    if (t.includes("BRUTE")) return "Brute Force";
    if (t.includes("AUTH")) return "Auth Failures";
    return "Crawl/Probe";
  }
  return null;
};

/** Buckets erzeugen: stündlich oder täglich. */
const buildBuckets = (
  events: IpTimelineEvent[],
  fromMs: number,
  toMs: number,
  granularity: "hour" | "day"
): ChartRow[] => {
  const stepMs = granularity === "hour" ? 3_600_000 : 86_400_000;

  const align = (ms: number) =>
    granularity === "hour"
      ? new Date(ms).setMinutes(0, 0, 0)
      : new Date(ms).setHours(0, 0, 0, 0);

  const start = align(fromMs);
  const end = align(toMs - 1) + stepMs;

  const buckets = new Map<number, ChartRow>();
  for (let t = start; t < end; t += stepMs) {
    const d = new Date(t);
    const label =
      granularity === "hour"
        ? format(d, "HH:mm")
        : format(d, "dd.MM", { locale: de });
    buckets.set(t, {
      iso: d.toISOString(),
      label,
      "Brute Force": 0,
      "Auth Failures": 0,
      "Port Scan": 0,
      Bans: 0,
      Unbans: 0,
      "Crawl/Probe": 0,
    });
  }

  events.forEach((ev) => {
    const t = new Date(ev.event_time).getTime();
    if (t < fromMs || t >= toMs) return;
    const key = align(t);
    const bucket = buckets.get(key);
    if (!bucket) return;
    const cat = classify(ev);
    if (cat) bucket[cat]++;
  });

  return Array.from(buckets.values());
};

const fmtTooltip = (iso: string, granularity: "hour" | "day") => {
  try {
    const d = new Date(iso);
    return granularity === "hour"
      ? format(d, "EEE, dd.MM.yyyy HH:mm", { locale: de }) + " Uhr"
      : format(d, "EEEE, dd.MM.yyyy", { locale: de });
  } catch {
    return iso;
  }
};

const IpActivityChart = ({ events }: Props) => {
  const [preset, setPreset] = useState<RangePreset>("30d");
  const [pickedDate, setPickedDate] = useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Range bestimmen
  const { fromMs, toMs, granularity, rangeLabel } = useMemo(() => {
    const now = Date.now();
    if (preset === "24h") {
      return {
        fromMs: now - 24 * 3_600_000,
        toMs: now,
        granularity: "hour" as const,
        rangeLabel: "letzte 24 Stunden · stündlich",
      };
    }
    if (preset === "day") {
      const day = pickedDate ?? new Date();
      const start = new Date(day);
      start.setHours(0, 0, 0, 0);
      const end = new Date(day);
      end.setHours(23, 59, 59, 999);
      return {
        fromMs: start.getTime(),
        toMs: end.getTime(),
        granularity: "hour" as const,
        rangeLabel: `${format(day, "EEEE, dd.MM.yyyy", { locale: de })} · stündlich`,
      };
    }
    const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
    return {
      fromMs: now - days * 86_400_000,
      toMs: now,
      granularity: "day" as const,
      rangeLabel: `letzte ${days} Tage · täglich`,
    };
  }, [preset, pickedDate]);

  const chartData = useMemo(
    () => buildBuckets(events, fromMs, toMs, granularity),
    [events, fromMs, toMs, granularity]
  );

  const totals = useMemo(() => {
    return chartData.reduce(
      (acc, r) => ({
        "Brute Force": acc["Brute Force"] + r["Brute Force"],
        "Auth Failures": acc["Auth Failures"] + r["Auth Failures"],
        "Port Scan": acc["Port Scan"] + r["Port Scan"],
        Bans: acc.Bans + r.Bans,
        Unbans: acc.Unbans + r.Unbans,
        "Crawl/Probe": acc["Crawl/Probe"] + r["Crawl/Probe"],
      }),
      { "Brute Force": 0, "Auth Failures": 0, "Port Scan": 0, Bans: 0, Unbans: 0, "Crawl/Probe": 0 }
    );
  }, [chartData]);

  const totalEvents =
    totals["Brute Force"] + totals["Auth Failures"] + totals["Port Scan"] +
    totals.Bans + totals.Unbans + totals["Crawl/Probe"];

  // Smart tick gap je nach Bucket-Anzahl
  const minTickGap = chartData.length > 60 ? 50 : chartData.length > 24 ? 30 : 10;

  return (
    <div className="border border-border/40 rounded bg-card/60 p-3">
      {/* Header mit Range-Picker */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Activity className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <span className="text-xs text-muted-foreground tracking-wide truncate">
            Aktivität · {rangeLabel}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground ml-1">
            ({totalEvents} Events)
          </span>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex items-center bg-card/40 border border-border/30 rounded p-0.5">
            {PRESETS.filter((p) => p.value !== "day").map((p) => (
              <button
                key={p.value}
                onClick={() => {
                  setPreset(p.value);
                  setPickedDate(undefined);
                }}
                className={cn(
                  "text-[11px] font-mono px-2 py-0.5 rounded transition-colors",
                  preset === p.value
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-7 px-2 text-[11px] font-mono gap-1.5",
                  preset === "day" && "border-primary/40 bg-primary/10 text-primary"
                )}
              >
                <CalendarIcon className="h-3 w-3" />
                {preset === "day" && pickedDate
                  ? format(pickedDate, "dd.MM.yyyy")
                  : "Datum"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 z-50" align="end">
              <Calendar
                mode="single"
                selected={pickedDate}
                onSelect={(d) => {
                  if (d) {
                    setPickedDate(d);
                    setPreset("day");
                    setCalendarOpen(false);
                  }
                }}
                disabled={(date) => date > new Date()}
                initialFocus
                locale={de}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Mini-Totals */}
      <div className="flex items-center gap-3 mb-2 flex-wrap text-[10px] font-mono">
        {([
          ["Brute Force", "bg-red-500"],
          ["Auth Failures", "bg-amber-500"],
          ["Port Scan", "bg-blue-500"],
          ["Bans", "bg-fuchsia-500"],
          ["Unbans", "bg-emerald-500"],
          ["Crawl/Probe", "bg-teal-500"],
        ] as Array<[keyof typeof totals, string]>).map(([key, dot]) => (
          <span key={key} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${dot}`} />
            <span className="text-muted-foreground">{key}:</span>
            <span className="text-foreground">{totals[key]}</span>
          </span>
        ))}
      </div>

      {/* Chart */}
      <div className="h-[200px]">
        {totalEvents === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
            Keine Events in diesem Zeitraum
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 8, bottom: 0, left: -25 }}>
              <defs>
                {[
                  ["g-act-brute", "hsl(0 84% 60%)"],
                  ["g-act-auth", "hsl(38 92% 50%)"],
                  ["g-act-port", "hsl(217 91% 60%)"],
                  ["g-act-ban", "hsl(290 70% 55%)"],
                  ["g-act-unban", "hsl(142 71% 45%)"],
                  ["g-act-crawl", "hsl(180 60% 45%)"],
                ].map(([id, color]) => (
                  <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.05} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 32% 17%)" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }}
                interval="preserveStartEnd"
                minTickGap={minTickGap}
              />
              <YAxis tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 4,
                  fontSize: 11,
                }}
                labelFormatter={(_, payload) => {
                  const iso = payload?.[0]?.payload?.iso;
                  return iso ? fmtTooltip(iso, granularity) : "";
                }}
                labelStyle={{ color: "hsl(var(--muted-foreground))" }}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Area type="monotone" dataKey="Brute Force" stackId="1" stroke="hsl(0 84% 60%)" fill="url(#g-act-brute)" strokeWidth={1.5} />
              <Area type="monotone" dataKey="Auth Failures" stackId="1" stroke="hsl(38 92% 50%)" fill="url(#g-act-auth)" strokeWidth={1.5} />
              <Area type="monotone" dataKey="Port Scan" stackId="1" stroke="hsl(217 91% 60%)" fill="url(#g-act-port)" strokeWidth={1.5} />
              <Area type="monotone" dataKey="Bans" stackId="1" stroke="hsl(290 70% 55%)" fill="url(#g-act-ban)" strokeWidth={1.5} />
              <Area type="monotone" dataKey="Unbans" stackId="1" stroke="hsl(142 71% 45%)" fill="url(#g-act-unban)" strokeWidth={1.5} />
              <Area type="monotone" dataKey="Crawl/Probe" stackId="1" stroke="hsl(180 60% 45%)" fill="url(#g-act-crawl)" strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default IpActivityChart;
