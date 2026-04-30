import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield } from "lucide-react";
import { mockCrowdSecAlertsLegacy as mockCrowdSecAlerts } from "@/data/mockSecurityData";
import { useApiData } from "@/hooks/useApiData";
import { fetchCrowdsecAlerts } from "@/lib/api";

const levelColor = (l: string) => (l === "CRIT" ? "destructive" : "secondary");

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
};

interface CrowdSecAlert {
  id: number;
  event_time: string;
  ip: string;
  scenario_name: string | null;
  normalized_reason: string | null;
  decision_source: string | null;
  alert_level: string;
  http_method: string | null;
  request_path: string | null;
  http_status: number | null;
  user_agent: string | null;
}

const CrowdSecAlerts = () => {
  const { data } = useApiData(
    () => fetchCrowdsecAlerts<CrowdSecAlert>(mockCrowdSecAlerts),
    [],
    30_000
  );
  const alerts = data ?? mockCrowdSecAlerts;

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Shield className="h-4 w-4 text-emerald-400" />
          CrowdSec Alerts – OPNsense
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[340px] overflow-y-auto">
        {alerts.map((a: any) => (
          <div
            key={a.id}
            className="flex items-start gap-3 rounded-lg border border-border/30 bg-secondary/30 p-3"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-foreground">{a.ip}</span>
                <Badge variant={levelColor(a.alert_level)} className="text-[10px] px-1.5">
                  {a.alert_level}
                </Badge>
                <Badge variant="outline" className="text-[10px] px-1.5 border-emerald-500/30 text-emerald-400">
                  {a.decision_source ?? a.decision_type ?? "ban"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate">{a.normalized_reason}</p>
              {a.request_path && (
                <p className="text-[10px] font-mono text-muted-foreground/70 truncate">
                  {a.http_method} {a.request_path}
                  {a.http_status && <span className="ml-2 text-amber-400">→ {a.http_status}</span>}
                </p>
              )}
              {a.user_agent && (
                <p className="text-[10px] text-muted-foreground/50 truncate">UA: {a.user_agent}</p>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap">{timeAgo(a.event_time)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default CrowdSecAlerts;
