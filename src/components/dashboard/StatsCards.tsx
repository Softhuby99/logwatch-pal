import { Shield, ShieldAlert, ShieldOff, Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { mockSecurityEvents, mockAuthEvents, mockIPSummary, mockCrowdSecAlerts } from "@/data/mockSecurityData";

const stats = [
  {
    label: "Security Events",
    value: mockSecurityEvents.length,
    icon: Activity,
    sub: "Letzte 24h",
    accent: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    label: "Gebannte IPs",
    value: mockIPSummary.filter((i) => i.current_status === "banned").length,
    icon: ShieldOff,
    sub: "Aktuell aktiv",
    accent: "text-red-400",
    bg: "bg-red-500/10",
  },
  {
    label: "Auth Failures",
    value: mockAuthEvents.filter((e) => e.auth_status === "failed").length,
    icon: ShieldAlert,
    sub: "Fehlgeschlagen",
    accent: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    label: "CrowdSec Alerts",
    value: mockCrowdSecAlerts.length,
    icon: Shield,
    sub: "OPNsense",
    accent: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
];

const StatsCards = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    {stats.map((s) => (
      <Card key={s.label} className="border-border/50 bg-card/80 backdrop-blur">
        <CardContent className="p-5 flex items-center gap-4">
          <div className={`rounded-xl p-3 ${s.bg}`}>
            <s.icon className={`h-6 w-6 ${s.accent}`} />
          </div>
          <div>
            <p className="text-2xl font-bold font-mono">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-[10px] text-muted-foreground/60">{s.sub}</p>
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

export default StatsCards;
