import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from "recharts";
import { eventsBySource } from "@/data/mockSecurityData";

const chartConfig = {
  Postfix: { label: "Postfix", color: "hsl(0 84% 60%)" },
  Netfilter: { label: "Netfilter", color: "hsl(38 92% 50%)" },
  Dovecot: { label: "Dovecot", color: "hsl(217 91% 60%)" },
  CrowdSec: { label: "CrowdSec", color: "hsl(142 71% 45%)" },
};

const SourceBreakdown = () => (
  <Card className="border-border/50 bg-card/80 backdrop-blur">
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">
        Events nach Quelle
      </CardTitle>
    </CardHeader>
    <CardContent>
      <ChartContainer config={chartConfig} className="h-[220px] w-full">
        <BarChart data={eventsBySource} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 32% 17%)" />
          <XAxis dataKey="source" tick={{ fontSize: 11, fill: "hsl(215 20% 55%)" }} />
          <YAxis tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {eventsBySource.map((entry, index) => (
              <Cell key={index} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </CardContent>
  </Card>
);

export default SourceBreakdown;
