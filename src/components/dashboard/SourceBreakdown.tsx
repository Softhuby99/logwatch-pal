import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, Legend, Tooltip } from "recharts";
import { eventsBySource } from "@/data/mockSecurityData";
import { useApiData } from "@/hooks/useApiData";
import { fetchEventsBySource, type EventsBySourceRow } from "@/lib/api";

const chartConfig = {
  Postfix: { label: "Postfix", color: "hsl(0 84% 60%)" },
  Netfilter: { label: "Netfilter", color: "hsl(38 92% 50%)" },
  Dovecot: { label: "Dovecot", color: "hsl(217 91% 60%)" },
  CrowdSec: { label: "CrowdSec", color: "hsl(142 71% 45%)" },
};

const CustomTooltip = ({ active, payload, label, sourceData }: any) => {
  if (!active || !payload?.length) return null;
  const entry = sourceData.find((e: EventsBySourceRow) => e.source === label);
  if (!entry) return null;

  return (
    <div className="bg-popover border border-border/50 rounded px-3 py-2 shadow-lg text-xs font-mono">
      <p className="font-medium text-foreground mb-1.5">{label}</p>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: entry.fill }} />
          <span className="text-muted-foreground">24h:</span>
          <span className="text-foreground font-medium">{entry.h24}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: entry.fillMid }} />
          <span className="text-muted-foreground">7 Tage:</span>
          <span className="text-foreground font-medium">{entry.d7}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: entry.fillLight }} />
          <span className="text-muted-foreground">30 Tage:</span>
          <span className="text-foreground font-medium">{entry.d30}</span>
        </div>
      </div>
    </div>
  );
};

const SourceBreakdown = () => {
  const { data } = useApiData(
    () => fetchEventsBySource(eventsBySource),
    [],
    30_000
  );
  const sourceData = data ?? eventsBySource;

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Events nach Quelle
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[220px] w-full">
          <BarChart data={sourceData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 32% 17%)" />
            <XAxis dataKey="source" tick={{ fontSize: 11, fill: "hsl(215 20% 55%)" }} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} />
            <Tooltip content={<CustomTooltip sourceData={sourceData} />} cursor={{ fill: "hsl(217 32% 17% / 0.3)" }} />
            <Legend
              formatter={(value: string) => (
                <span className="text-[10px] text-muted-foreground">{value}</span>
              )}
              wrapperStyle={{ fontSize: 10 }}
            />
            <Bar dataKey="d30" name="30 Tage" radius={[4, 4, 0, 0]} barSize={18}>
              {sourceData.map((entry, i) => (
                <Cell key={i} fill={entry.fillLight} />
              ))}
            </Bar>
            <Bar dataKey="d7" name="7 Tage" radius={[4, 4, 0, 0]} barSize={18}>
              {sourceData.map((entry, i) => (
                <Cell key={i} fill={entry.fillMid} />
              ))}
            </Bar>
            <Bar dataKey="h24" name="24h" radius={[4, 4, 0, 0]} barSize={18}>
              {sourceData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export default SourceBreakdown;
