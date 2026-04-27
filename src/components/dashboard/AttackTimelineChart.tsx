import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { format } from "date-fns";
import { Info, MousePointerClick } from "lucide-react";
import { buildAttackBuckets } from "@/lib/ipTimeline";
import BucketDetailSheet from "./BucketDetailSheet";

const BUCKET_HOURS = 4;
const TOTAL_HOURS = 24 * 7;

const ATTACK_TYPES = [
  { key: "brute_force", label: "Brute Force", color: "hsl(0 84% 60%)" },
  { key: "auth_failure", label: "Auth Failure", color: "hsl(38 92% 50%)" },
  { key: "port_scan", label: "Port Scan", color: "hsl(217 91% 60%)" },
  { key: "ban", label: "Ban/Unban", color: "hsl(280 70% 55%)" },
  { key: "crawl_probe", label: "Crawl/Probe", color: "hsl(142 71% 45%)" },
] as const;

const chartConfig = Object.fromEntries(
  ATTACK_TYPES.map((t) => [t.key, { label: t.label, color: t.color }])
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  let formattedTime = label;
  try {
    const start = new Date(label);
    const end = new Date(start.getTime() + BUCKET_HOURS * 60 * 60 * 1000);
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
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: type?.color }}
              />
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
  const data = useMemo(() => buildAttackBuckets(BUCKET_HOURS, TOTAL_HOURS), []);
  const [openBucket, setOpenBucket] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const formatXAxis = (iso: string) => {
    try {
      return format(new Date(iso), "dd.MM HH:mm");
    } catch {
      return iso;
    }
  };

  const handleClick = (e: any) => {
    // recharts onClick liefert activeLabel = X-Wert (unser ISO-String)
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
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-normal text-foreground tracking-wide">
              Attack Timeline (7 Tage)
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                <MousePointerClick className="h-3 w-3" />
                Bucket anklicken für Drilldown
              </span>
              <button className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
                <Info className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-1">
            {ATTACK_TYPES.map((t) => (
              <div key={t.key} className="flex items-center gap-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: t.color }}
                />
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
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.3)" }} />
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
        bucketHours={BUCKET_HOURS}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
};

export default AttackTimelineChart;
