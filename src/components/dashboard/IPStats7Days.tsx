import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mockIPSummary } from "@/data/mockSecurityData";
import { format } from "date-fns";

const IPStats7Days = () => {
  const sorted = [...mockIPSummary].sort((a, b) => b.total_events - a.total_events);

  const formatTime = (iso: string) => {
    try {
      return format(new Date(iso), "yyyy-MM-dd HH:mm:ss");
    } catch {
      return iso;
    }
  };

  // Derive most frequent reason from last_event_type
  const normalizeReason = (type: string) =>
    type.replace(/_/g, "_"); // keep as-is, matching Grafana style

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Statistik nach IP 7 Tage
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/30 hover:bg-transparent">
                <TableHead className="text-xs">ip</TableHead>
                <TableHead className="text-xs text-right">treffer</TableHead>
                <TableHead className="text-xs">erstes_auftreten</TableHead>
                <TableHead className="text-xs">letztes_auftreten</TableHead>
                <TableHead className="text-xs">haeufigstes_zielkonto</TableHead>
                <TableHead className="text-xs">haeufigster_grund</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((ip) => (
                <TableRow key={ip.ip} className="border-border/20 font-mono text-xs">
                  <TableCell className="text-foreground font-medium">{ip.ip}</TableCell>
                  <TableCell className="text-right">{ip.total_events}</TableCell>
                  <TableCell className="text-muted-foreground">{formatTime(ip.first_seen)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatTime(ip.last_seen)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {ip.last_target_email || "–"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {normalizeReason(ip.last_event_type)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default IPStats7Days;
