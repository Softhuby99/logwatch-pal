import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Info, MousePointerClick, CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildAttackBuckets } from "@/lib/ipTimeline";
import BucketDetailSheet from "./BucketDetailSheet";

type RangePreset = "24h" | "7d" | "30d" | "day";

const ATTACK_TYPES = [
  { key: "brute_force", label: "Brute Force", color: "hsl(0 84% 60%)" },
  { key: "auth_failure", label: "Auth Failure", color: "hsl(38 92% 50%)" },
  { key: "port_scan", label: "Port Scan", color: "hsl(217 91% 60%)" },
  { key: "ban", label: "Ban", color: "hsl(280 70% 55%)" },
  { key: "unban", label: "Unban", color: "hsl(142 71% 45%)" },
  { key: "crawl_probe", label: "Crawl/Probe", color: "hsl(160 60% 45%)" },
] as const;

const chartConfig = Object.fromEntries(
  ATTACK_TYPES.map((t) => [t.key, { label: t.label, color: t.color }])
);

const PRESETS: Array<{ value: RangePreset; label: string }> = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7T" },
  { value: "30d", label: "30T" },
];

const CustomTooltip = ({ active, payload, label, bucketHours }: any) => {
  if (!active || !payload?.length) return null;
  let formattedTime = label;
  try {
    const start = new Date(label);
    const end = new Date(start.getTime() + bucketHours * 60 * 60 * 1000);
    formattedTime = `${format(start, "dd.MM. HH:mm")} – ${format(end, "HH:mm")}`;
  } catch {}

  return (
    <div className="bg-popover border border-border/50 rounded px-3 py-2 shadow-lg text-xs font-mono">
      <p className="text-muted-foreground mb-1.5">{formattedTime}</p>
      <div className="space-y-1">
        {payload.map((p: any) => {
          const type = ATTACK_TYPES.find((t) => t.key === p.dataKey);
          return (
            <div key={p.dataKey} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: type?.color }} />
              <span className="text-muted-foreground w-24">{type?.label}:</span>
              <span className="text-foreground font-medium">{p.value}</span>
            </div>
          );
        })}
        <div className="border-t border-border/30 mt-1 pt-1 flex justify-between">
          <span className="text-muted-foreground">Gesamt:</span>
          <span className="text-foreground font-medium">
            {payload.reduce((sum: number, p: any) => sum + (p.value || 0), 0)}
          </span>
        </div>
        <div className="text-[10px] text-primary mt-1 flex items-center gap-1">
          <MousePointerClick className="h-2.5 w-2.5" />
          Klick für Details
        </div>
      </div>
    </div>
  );
};

const AttackTimelineChart = () => {
  const [preset, setPreset] = useState<RangePreset>("7d");
  const [pickedDate, setPickedDate] = useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [openBucket, setOpenBucket] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { bucketHours, totalHours, title } = useMemo(() => {
    if (preset === "24h") return { bucketHours: 1, totalHours: 24, title: "24 Stunden · stündlich" };
    if (preset === "30d") return { bucketHours: 12, totalHours: 24 * 30, title: "30 Tage · 12h Buckets" };
    if (preset === "day" && pickedDate) {
      return { bucketHours: 1, totalHours: 24, title: `${format(pickedDate, "EEE, dd.MM.yyyy", { locale: de })} · stündlich` };
    }
    return { bucketHours: 4, totalHours: 24 * 7, title: "7 Tage · 4h Buckets" };
  }, [preset, pickedDate]);

  const data = useMemo(() => {
    if (preset === "day" && pickedDate) {
      // build all buckets and filter for selected day
      const all = buildAttackBuckets(1, 24 * 32);
      const dayStart = new Date(pickedDate); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = dayStart.getTime() + 86_400_000;
      return all.filter((b) => {
        const t = new Date(b.time).getTime();
        return t >= dayStart.getTime() && t < dayEnd;
      });
    }
    return buildAttackBuckets(bucketHours, totalHours);
  }, [preset, pickedDate, bucketHours, totalHours]);

  const formatXAxis = (iso: string) => {
    try {
      return preset === "24h" || preset === "day"
        ? format(new Date(iso), "HH:mm")
        : format(new Date(iso), "dd.MM HH:mm");
    } catch {
      return iso;
    }
  };

  const handleClick = (e: any) => {
    const iso = e?.activeLabel;
    if (typeof iso === "string") {
      setOpenBucket(iso);
      setSheetOpen(true);
    }
  };

  return (
    <>
      <Card className="border-border/50 bg-card/80 backdrop-blur">
        <CardHeader className="px-4 py-2 border-b border-border/30">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-normal text-foreground tracking-wide">
              Attack Timeline · {title}
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-card/40 border border-border/30 rounded p-0.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => { setPreset(p.value); setPickedDate(undefined); }}
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
                    {preset === "day" && pickedDate ? format(pickedDate, "dd.MM.yyyy") : "Datum"}
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
              <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                <MousePointerClick className="h-3 w-3" />
                Bucket = Drilldown
              </span>
              <button className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
                <Info className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {ATTACK_TYPES.map((t) => (
              <div key={t.key} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: t.color }} />
                <span className="text-[10px] text-muted-foreground">{t.label}</span>
              </div>
            ))}
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <ChartContainer config={chartConfig} className="h-[260px] w-full">
            <AreaChart
              data={data}
              margin={{ top: 5, right: 10, bottom: 0, left: -20 }}
              onClick={handleClick}
              style={{ cursor: "pointer" }}
            >
              <defs>
                {ATTACK_TYPES.map((t) => (
                  <linearGradient key={t.key} id={`grad-${t.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={t.color} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={t.color} stopOpacity={0.05} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 32% 17%)" />
              <XAxis
                dataKey="time"
                tickFormatter={formatXAxis}
                tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }}
                interval="preserveStartEnd"
                minTickGap={60}
              />
              <YAxis tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} />
              <Tooltip
                content={<CustomTooltip bucketHours={bucketHours} />}
                cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
              />
              {ATTACK_TYPES.map((t) => (
                <Area
                  key={t.key}
                  type="monotone"
                  dataKey={t.key}
                  stackId="attacks"
                  stroke={t.color}
                  strokeWidth={1.5}
                  fill={`url(#grad-${t.key})`}
                />
              ))}
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <BucketDetailSheet
        bucketStart={openBucket}
        bucketHours={bucketHours}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
};

export default AttackTimelineChart;
