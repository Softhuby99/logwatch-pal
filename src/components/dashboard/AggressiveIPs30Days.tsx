import { useState, useMemo, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { mockAggressiveIPs30Days } from "@/data/mockSecurityData";
import { format } from "date-fns";
import { ChevronDown, ChevronUp, Filter, Info } from "lucide-react";
import type { AlertLevel, RiskLevel } from "@/types/database";
import { useIpDetail } from "@/contexts/IpDetailContext";
import { useApiData } from "@/hooks/useApiData";
import { fetchAggressiveIps30d } from "@/lib/api";

const levelClass = (level: AlertLevel | null): string => {
  if (level === "CRIT") return "bg-red-500/20 text-red-400 border-red-500/30";
  if (level === "WARN") return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  return "bg-muted text-muted-foreground border-border/30";
};

const riskLevelClass = (level: RiskLevel): string => {
  if (level === "CRIT") return "bg-red-600/30 text-red-300 border-red-600/40";
  if (level === "HIGH") return "bg-orange-500/20 text-orange-400 border-orange-500/30";
  if (level === "MEDIUM") return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
};

const eventTypeClass = (type: string | null): string => {
  if (!type) return "bg-muted text-muted-foreground border-border/30";
  const g = type.toLowerCase();
  if (g.includes("banning") || g.includes("brute")) return "bg-red-500/20 text-red-400 border-red-500/30";
  if (g.includes("unbanning")) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  if (g.includes("improper") || g.includes("non_smtp") || g.includes("warning")) return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  if (g.includes("ssh") || g.includes("http") || g.includes("probe") || g.includes("scan")) return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  if (g.includes("lost_connection")) return "bg-orange-500/20 text-orange-400 border-orange-500/30";
  return "bg-muted text-muted-foreground border-border/30";
};

type SortDir = "asc" | "desc" | null;
type SortKey =
  | "ip" | "total_events" | "risk_score" | "risk_level" | "last_alert_level"
  | "last_source_component" | "last_event_type" | "last_username"
  | "last_seen" | "last_message" | "org_name" | "country" | "ptr"
  | "last_destination_port";

const AggressiveIPs30Days = () => {
  const { openIp } = useIpDetail();
  const { data: apiData } = useApiData(
    () => fetchAggressiveIps30d(mockAggressiveIPs30Days),
    [],
    30_000
  );
  const sourceData = apiData ?? mockAggressiveIPs30Days;
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("risk_score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setOpenFilter(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const formatTime = (iso: string) => {
    try { return format(new Date(iso), "yyyy-MM-dd HH:mm:ss"); } catch { return iso; }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const portLabel = (row: typeof mockAggressiveIPs30Days[number]) =>
    row.last_destination_port
      ? `${row.last_destination_port}${row.last_destination_service ? `/${row.last_destination_service}` : ""}`
      : "-";

  const filtered = useMemo(() => {
    return sourceData.filter((row) => {
      const vals: Record<string, string> = {
        ip: row.ip,
        total_events: String(row.total_events),
        risk_score: String(row.risk_score),
        risk_level: row.risk_level,
        last_alert_level: row.last_alert_level ?? "",
        last_source_component: row.last_source_component ?? "",
        last_event_type: row.last_event_type ?? "",
        last_username: row.last_username ?? "-",
        last_seen: formatTime(row.last_seen),
        last_message: row.last_message ?? "",
        org_name: row.org_name ?? "unbekannt",
        country: row.country ?? "??",
        ptr: row.ptr ?? "-",
        last_destination_port: portLabel(row),
      };
      return Object.entries(filters).every(([key, search]) => !search || vals[key]?.toLowerCase().includes(search.toLowerCase()));
    });
  }, [filters]);

  const sorted = useMemo(() => {
    if (!sortDir) return filtered;
    return [...filtered].sort((a, b) => {
      let aVal: string | number = "", bVal: string | number = "";
      switch (sortKey) {
        case "ip": aVal = a.ip; bVal = b.ip; break;
        case "total_events": aVal = a.total_events; bVal = b.total_events; break;
        case "risk_score": aVal = a.risk_score; bVal = b.risk_score; break;
        case "risk_level": {
          const order: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRIT: 3 };
          aVal = order[a.risk_level]; bVal = order[b.risk_level]; break;
        }
        case "last_alert_level": aVal = a.last_alert_level ?? ""; bVal = b.last_alert_level ?? ""; break;
        case "last_source_component": aVal = a.last_source_component ?? ""; bVal = b.last_source_component ?? ""; break;
        case "last_event_type": aVal = a.last_event_type ?? ""; bVal = b.last_event_type ?? ""; break;
        case "last_username": aVal = a.last_username ?? ""; bVal = b.last_username ?? ""; break;
        case "last_seen": aVal = new Date(a.last_seen).getTime(); bVal = new Date(b.last_seen).getTime(); break;
        case "last_message": aVal = a.last_message ?? ""; bVal = b.last_message ?? ""; break;
        case "org_name": aVal = a.org_name ?? ""; bVal = b.org_name ?? ""; break;
        case "country": aVal = a.country ?? ""; bVal = b.country ?? ""; break;
        case "ptr": aVal = a.ptr ?? ""; bVal = b.ptr ?? ""; break;
        case "last_destination_port": aVal = portLabel(a); bVal = portLabel(b); break;
      }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const columns: { key: SortKey; label: string }[] = [
    { key: "ip", label: "ip" },
    { key: "risk_score", label: "risk_score" },
    { key: "risk_level", label: "risk_level" },
    { key: "total_events", label: "treffer" },
    { key: "last_alert_level", label: "level" },
    { key: "last_source_component", label: "quelle" },
    { key: "last_event_type", label: "grund" },
    { key: "last_username", label: "konto" },
    { key: "last_seen", label: "last_seen" },
    { key: "last_message", label: "letzte_meldung" },
    { key: "org_name", label: "organisation / ASN" },
    { key: "country", label: "land" },
    { key: "ptr", label: "PTR" },
    { key: "last_destination_port", label: "ziel_port" },
  ];

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur rounded-none border-0 border-t border-border/30">
      <CardHeader className="px-4 py-2 border-b border-border/30">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-normal text-foreground tracking-wide">
            Top aggressive external IPs (30 Days)
          </CardTitle>
          <button className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
            <Info className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          JOIN ip_summary × ip_enrichment × ip_risk_score · sortiert nach Risk-Score
        </p>
      </CardHeader>

      <CardContent className="p-0" ref={filterRef}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/20 hover:bg-transparent bg-transparent">
                {columns.map((col) => (
                  <TableHead key={col.key} className="text-xs font-normal text-muted-foreground px-3 py-2 relative whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => handleSort(col.key)} className="flex items-center gap-1 hover:text-foreground transition-colors">
                        <span>{col.label}</span>
                        {sortKey === col.key && sortDir === "desc" && <ChevronDown className="h-3 w-3 text-primary" />}
                        {sortKey === col.key && sortDir === "asc" && <ChevronUp className="h-3 w-3 text-primary" />}
                      </button>
                      <button
                        onClick={() => setOpenFilter(openFilter === col.key ? null : col.key)}
                        className={`p-0.5 rounded transition-colors ${filters[col.key] ? "text-primary" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
                      >
                        <Filter className="h-2.5 w-2.5" />
                      </button>
                    </div>
                    {openFilter === col.key && (
                      <div className="absolute top-full left-0 z-20 mt-1 bg-popover border border-border/50 rounded shadow-lg p-2 min-w-[180px]">
                        <input autoFocus type="text" placeholder="Filter value..." value={filters[col.key] || ""}
                          onChange={(e) => setFilters((f) => ({ ...f, [col.key]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Escape" || e.key === "Enter") setOpenFilter(null); }}
                          className="w-full bg-background text-foreground text-xs px-2 py-1.5 border border-border/50 rounded outline-none focus:border-primary/50 font-mono"
                        />
                        {filters[col.key] && (
                          <button onClick={() => { setFilters((f) => { const n = { ...f }; delete n[col.key]; return n; }); setOpenFilter(null); }}
                            className="text-[10px] text-muted-foreground hover:text-foreground mt-1 block">Filter zurücksetzen</button>
                        )}
                      </div>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow><TableCell colSpan={columns.length} className="text-center text-muted-foreground text-xs py-8">Keine Ergebnisse</TableCell></TableRow>
              ) : sorted.map((row, i) => (
                <TableRow
                  key={row.ip}
                  onClick={() => openIp(row.ip)}
                  className={`border-border/10 font-mono text-xs cursor-pointer hover:bg-muted/30 transition-colors ${i % 2 === 0 ? "bg-transparent" : "bg-muted/10"}`}
                >
                  <TableCell className="text-primary hover:underline font-medium px-3 py-2">{row.ip}</TableCell>
                  <TableCell className="text-foreground px-3 py-2 font-semibold">{row.risk_score}</TableCell>
                  <TableCell className="px-3 py-2">
                    <Badge variant="outline" className={`text-[10px] px-1.5 font-mono ${riskLevelClass(row.risk_level)}`}>{row.risk_level}</Badge>
                  </TableCell>
                  <TableCell className="text-foreground px-3 py-2">{row.total_events}</TableCell>
                  <TableCell className="px-3 py-2">
                    {row.last_alert_level && (
                      <Badge variant="outline" className={`text-[10px] px-1.5 font-mono ${levelClass(row.last_alert_level)}`}>{row.last_alert_level}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground px-3 py-2">{row.last_source_component ?? "-"}</TableCell>
                  <TableCell className="px-3 py-2">
                    {row.last_event_type && (
                      <Badge variant="outline" className={`text-[10px] px-1.5 font-mono ${eventTypeClass(row.last_event_type)}`}>{row.last_event_type}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground px-3 py-2">{row.last_username ?? "-"}</TableCell>
                  <TableCell className="text-muted-foreground px-3 py-2 whitespace-nowrap">{formatTime(row.last_seen)}</TableCell>
                  <TableCell className="text-muted-foreground px-3 py-2 max-w-[400px] truncate" title={row.last_message ?? ""}>{row.last_message ?? "-"}</TableCell>
                  <TableCell className="text-muted-foreground px-3 py-2">
                    <span className="text-foreground/80">{row.org_name ?? "unbekannt"}</span>
                    {row.asn && <span className="ml-1 text-muted-foreground/60">({row.asn})</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground px-3 py-2">{row.country ?? "??"}</TableCell>
                  <TableCell className="text-muted-foreground px-3 py-2">{row.ptr ?? "-"}</TableCell>
                  <TableCell className="text-muted-foreground px-3 py-2">{portLabel(row)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default AggressiveIPs30Days;
