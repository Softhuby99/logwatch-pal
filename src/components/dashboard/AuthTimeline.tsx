import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import { authFailureTimeline } from "@/data/mockSecurityData";
import { useApiData } from "@/hooks/useApiData";
import { fetchAuthTimeline } from "@/lib/api";
import { DrilldownSheet } from "./DrilldownSheet";

const chartConfig = {
  smtp: { label: "SMTP", color: "hsl(0 84% 60%)" },
  imap: { label: "IMAP", color: "hsl(217 91% 60%)" },
};

const AuthTimeline = () => {
  const { data } = useApiData(
    () => fetchAuthTimeline(authFailureTimeline),
    [],
    30_000
  );
  const chartData = data && data.length > 0 ? data : authFailureTimeline;

  const [sheet, setSheet] = useState<{ open: boolean; hour: string | null }>({
    open: false,
    hour: null,
  });

  const handleClick = (e: any) => {
    const hour = e?.activeLabel as string | undefined;
    if (hour) setSheet({ open: true, hour });
  };

  return (
    <>
      <Card className="border-border/50 bg-card/80 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Auth Failures – Letzte 24h
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[220px] w-full">
            <AreaChart
              data={chartData}
              margin={{ top: 5, right: 5, bottom: 0, left: -20 }}
              onClick={handleClick}
              style={{ cursor: "pointer" }}
            >
              <defs>
                <linearGradient id="smtpGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(0 84% 60%)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(0 84% 60%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="imapGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(217 91% 60%)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(217 91% 60%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 32% 17%)" />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} interval={3} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area type="monotone" dataKey="smtp" stroke="hsl(0 84% 60%)" fill="url(#smtpGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="imap" stroke="hsl(217 91% 60%)" fill="url(#imapGrad)" strokeWidth={2} />
            </AreaChart>
          </ChartContainer>
          <p className="mt-1 text-[10px] text-muted-foreground/70 font-mono">
            Tipp: Auf einen Zeitpunkt klicken für Details (Events &amp; IPs).
          </p>
        </CardContent>
      </Card>

      <DrilldownSheet
        open={sheet.open}
        onOpenChange={(v) => setSheet((s) => ({ ...s, open: v }))}
        title="Auth Failures · Stundenfenster"
        subtitle={sheet.hour ? `Stunde ${sheet.hour} (letzte 24h)` : undefined}
        endpoint={sheet.hour ? `/auth-events/by-hour?hour=${encodeURIComponent(sheet.hour)}` : null}
      />
    </>
  );
};

export default AuthTimeline;
