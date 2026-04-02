import { Shield, ShieldAlert, ShieldOff, Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { mockSecurityEvents, mockAuthEvents, mockIPSummary, mockCrowdSecAlerts } from "@/data/mockSecurityData";

interface TimeBreakdown {
  h24: number;
  d7: number;
  d30: number;
}

const maxOf = (b: TimeBreakdown) => Math.max(b.h24, b.d7, b.d30, 1);

const stats: {
  label: string;
  value: number;
  icon: typeof Activity;
  accent: string;
  bg: string;
  barColor: string;
  breakdown: TimeBreakdown;
}[] = [
  {
    label: "Security Events",
    value: mockSecurityEvents.length,
    icon: Activity,
    accent: "text-blue-400",
    bg: "bg-blue-500/10",
    barColor: "bg-blue-400",
    breakdown: { h24: mockSecurityEvents.length, d7: mockSecurityEvents.length * 4, d30: mockSecurityEvents.length * 14 },
  },
  {
    label: "Gebannte IPs",
    value: mockIPSummary.filter((i) => i.current_status === "banned").length,
    icon: ShieldOff,
    accent: "text-red-400",
    bg: "bg-red-500/10",
    barColor: "bg-red-400",
    breakdown: { h24: mockIPSummary.filter((i) => i.current_status === "banned").length, d7: 12, d30: 38 },
  },
  {
    label: "Auth Failures",
    value: mockAuthEvents.filter((e) => e.auth_status === "failed").length,
    icon: ShieldAlert,
    accent: "text-amber-400",
    bg: "bg-amber-500/10",
    barColor: "bg-amber-400",
    breakdown: { h24: mockAuthEvents.filter((e) => e.auth_status === "failed").length, d7: 89, d30: 347 },
  },
  {
    label: "CrowdSec Alerts",
    value: mockCrowdSecAlerts.length,
    icon: Shield,
    accent: "text-emerald-400",
    bg: "bg-emerald-500/10",
    barColor: "bg-emerald-400",
    breakdown: { h24: mockCrowdSecAlerts.length, d7: 31, d30: 124 },
  },
];

const periods = ["24h", "7d", "30d"] as const;
const getVal = (b: TimeBreakdown, p: (typeof periods)[number]) =>
  p === "24h" ? b.h24 : p === "7d" ? b.d7 : b.d30;

const StatsCards = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    {stats.map((s) => {
      const max = maxOf(s.breakdown);
      return (
        <Card key={s.label} className="border-border/50 bg-card/80 backdrop-blur">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className={`rounded-xl p-3 ${s.bg}`}>
                <s.icon className={`h-6 w-6 ${s.accent}`} />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
            {/* Time breakdown bars */}
            <div className="mt-3 space-y-1.5">
              {periods.map((p) => {
                const val = getVal(s.breakdown, p);
                const pct = Math.max((val / max) * 100, 4);
                return (
                  <div key={p} className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground/70 w-6 text-right font-mono">{p}</span>
                    <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${s.barColor} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono w-8 text-right">{val}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      );
    })}
  </div>
);

export default StatsCards;
