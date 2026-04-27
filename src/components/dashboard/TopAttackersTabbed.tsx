import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";
import { format } from "date-fns";
import { getTopAttackers, type TimeWindow, type TopAttackerRow } from "@/lib/ipTimeline";
import { useIpDetail } from "@/contexts/IpDetailContext";
import type { AlertLevel, RiskLevel } from "@/types/database";

const levelClass = (lvl: AlertLevel | null) => {
  if (lvl === "CRIT") return "bg-red-500/20 text-red-400 border-red-500/30";
  if (lvl === "WARN") return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  return "bg-muted text-muted-foreground border-border/30";
};

const riskClass = (lvl: RiskLevel) => {
  if (lvl === "CRIT") return "bg-red-600/30 text-red-300 border-red-600/40";
  if (lvl === "HIGH") return "bg-orange-500/20 text-orange-400 border-orange-500/30";
  if (lvl === "MEDIUM") return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
};

const fmt = (iso: string) => {
  try { return format(new Date(iso), "yyyy-MM-dd HH:mm"); } catch { return iso; }
};

const WINDOWS: { key: TimeWindow; label: string }[] = [
  { key: "24h", label: "24 Stunden" },
  { key: "7d", label: "7 Tage" },
  { key: "30d", label: "30 Tage" },
];

const Row = ({ row, onClick }: { row: TopAttackerRow; onClick: (ip: string) => void }) => (
  <TableRow
    className="border-border/10 font-mono text-xs hover:bg-muted/30 cursor-pointer transition-colors"
    onClick={() => onClick(row.ip)}
  >
    <TableCell className="px-3 py-2">
      <button className="text-primary hover:underline font-medium">{row.ip}</button>
    </TableCell>
    <TableCell className="px-3 py-2 font-semibold text-foreground">{row.risk_score}</TableCell>
    <TableCell className="px-3 py-2">
      <Badge variant="outline" className={`text-[10px] px-1.5 font-mono ${riskClass(row.risk_level)}`}>
        {row.risk_level}
      </Badge>
    </TableCell>
    <TableCell className="px-3 py-2 text-foreground">{row.total_events}</TableCell>
    <TableCell className="px-3 py-2 text-red-400">{row.bans}</TableCell>
    <TableCell className="px-3 py-2 text-amber-400">{row.auth_failures}</TableCell>
    <TableCell className="px-3 py-2 text-blue-400">{row.crowdsec}</TableCell>
    <TableCell className="px-3 py-2">
      {row.last_alert_level && (
        <Badge variant="outline" className={`text-[10px] px-1.5 font-mono ${levelClass(row.last_alert_level)}`}>
          {row.last_alert_level}
        </Badge>
      )}
    </TableCell>
    <TableCell className="px-3 py-2 text-muted-foreground truncate max-w-[160px]" title={row.last_event_type ?? ""}>
      {row.last_event_type ?? "-"}
    </TableCell>
    <TableCell className="px-3 py-2 text-muted-foreground">{row.country ?? "??"}</TableCell>
    <TableCell className="px-3 py-2 text-muted-foreground truncate max-w-[180px]" title={row.org_name ?? ""}>
      {row.org_name ?? "unbekannt"}
    </TableCell>
    <TableCell className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmt(row.last_seen)}</TableCell>
  </TableRow>
);

const TopAttackersTabbed = () => {
  const [active, setActive] = useState<TimeWindow>("24h");
  const { openIp } = useIpDetail();

  const rows = useMemo(() => getTopAttackers(active, 25), [active]);

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur">
      <CardHeader className="px-4 py-2 border-b border-border/30">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-normal text-foreground tracking-wide">
            Top Angreifer
          </CardTitle>
          <button className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
            <Info className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-1 mt-2">
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              onClick={() => setActive(w.key)}
              className={`text-xs px-3 py-1 rounded-sm font-mono transition-colors ${
                active === w.key
                  ? "bg-primary/20 text-primary border border-primary/40"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-transparent"
              }`}
            >
              {w.label}
            </button>
          ))}
          <span className="ml-auto text-[10px] text-muted-foreground">
            {rows.length} IPs · klick für Details
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/20 hover:bg-transparent">
                <TableHead className="text-xs font-normal text-muted-foreground px-3 py-2">ip</TableHead>
                <TableHead className="text-xs font-normal text-muted-foreground px-3 py-2">risk</TableHead>
                <TableHead className="text-xs font-normal text-muted-foreground px-3 py-2">level</TableHead>
                <TableHead className="text-xs font-normal text-muted-foreground px-3 py-2">events</TableHead>
                <TableHead className="text-xs font-normal text-muted-foreground px-3 py-2">bans</TableHead>
                <TableHead className="text-xs font-normal text-muted-foreground px-3 py-2">auth_fail</TableHead>
                <TableHead className="text-xs font-normal text-muted-foreground px-3 py-2">crowdsec</TableHead>
                <TableHead className="text-xs font-normal text-muted-foreground px-3 py-2">alert</TableHead>
                <TableHead className="text-xs font-normal text-muted-foreground px-3 py-2">last_event</TableHead>
                <TableHead className="text-xs font-normal text-muted-foreground px-3 py-2">land</TableHead>
                <TableHead className="text-xs font-normal text-muted-foreground px-3 py-2">organisation</TableHead>
                <TableHead className="text-xs font-normal text-muted-foreground px-3 py-2">last_seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-xs text-muted-foreground py-8">
                    Keine Angriffe in diesem Zeitraum
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => <Row key={row.ip} row={row} onClick={openIp} />)
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default TopAttackersTabbed;
