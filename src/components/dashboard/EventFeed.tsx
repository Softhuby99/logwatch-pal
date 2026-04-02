import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { mockSecurityEvents } from "@/data/mockSecurityData";

const levelStyle = (l: string) => {
  if (l === "CRIT") return "destructive";
  if (l === "WARN") return "secondary";
  return "outline";
};

const componentColor = (c: string) => {
  const map: Record<string, string> = {
    postfix: "text-red-400",
    netfilter: "text-amber-400",
    dovecot: "text-blue-400",
    crowdsec: "text-emerald-400",
  };
  return map[c] || "text-muted-foreground";
};

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
};

const EventFeed = () => {
  const sorted = [...mockSecurityEvents].sort(
    (a, b) => new Date(b.event_time).getTime() - new Date(a.event_time).getTime()
  );

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Live Event Feed
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 max-h-[340px] overflow-y-auto">
        {sorted.map((e) => (
          <div
            key={e.id}
            className="flex items-center gap-2 rounded border border-border/20 bg-secondary/20 px-3 py-2"
          >
            <span className="text-[10px] font-mono text-muted-foreground/60 w-8">{timeAgo(e.event_time)}</span>
            <Badge variant={levelStyle(e.alert_level)} className="text-[9px] px-1 min-w-[36px] justify-center">
              {e.alert_level}
            </Badge>
            <span className={`text-[10px] font-medium w-16 ${componentColor(e.source_component)}`}>
              {e.source_component}
            </span>
            <span className="text-xs font-mono text-foreground/90 w-28">{e.ip}</span>
            <span className="text-[10px] text-muted-foreground truncate flex-1">
              {e.event_type.replace(/_/g, " ")}
            </span>
            {e.destination_port && (
              <span className="text-[10px] font-mono text-muted-foreground/50">
                :{e.destination_port}
              </span>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default EventFeed;
