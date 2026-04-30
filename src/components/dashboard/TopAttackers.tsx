import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { mockIPSummary } from "@/data/mockSecurityData";
import { useIpDetail } from "@/contexts/IpDetailContext";
import { useApiData } from "@/hooks/useApiData";
import { fetchTopAttackers } from "@/lib/api";
import type { IpSummary } from "@/types/database";

const statusColor = (s: string) => {
  if (s === "banned") return "destructive";
  return "secondary";
};

const TopAttackers = () => {
  const { openIp } = useIpDetail();
  const { data: apiData } = useApiData(
    () => fetchTopAttackers<IpSummary>("24h", mockIPSummary),
    [],
    30_000
  );
  const sorted = [...(apiData ?? mockIPSummary)].sort((a, b) => (b.total_events ?? 0) - (a.total_events ?? 0));

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Top Angreifer – IP Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-border/30 hover:bg-transparent">
              <TableHead className="text-xs">IP</TableHead>
              <TableHead className="text-xs text-center">Events</TableHead>
              <TableHead className="text-xs text-center">Bans</TableHead>
              <TableHead className="text-xs text-center">Auth Fail</TableHead>
              <TableHead className="text-xs text-center">Port</TableHead>
              <TableHead className="text-xs text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((ip: any) => (
              <TableRow
                key={ip.ip}
                className="border-border/20 font-mono text-xs cursor-pointer hover:bg-muted/30"
                onClick={() => openIp(ip.ip)}
              >
                <TableCell className="text-primary hover:underline font-medium">{ip.ip}</TableCell>
                <TableCell className="text-center">{ip.total_events}</TableCell>
                <TableCell className="text-center text-red-400">{ip.total_bans ?? ip.bans ?? 0}</TableCell>
                <TableCell className="text-center text-amber-400">{ip.total_auth_failures ?? ip.auth_failures ?? 0}</TableCell>
                <TableCell className="text-center text-muted-foreground">
                  {ip.last_destination_port ? `${ip.last_destination_port}/${ip.last_destination_service}` : "–"}
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant={statusColor(ip.current_status ?? "active")} className="text-[10px] px-1.5">
                    {ip.current_status ?? "active"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default TopAttackers;
