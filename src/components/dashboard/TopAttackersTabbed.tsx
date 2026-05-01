import { useState, useMemo, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Filter, Info } from "lucide-react";
import { format } from "date-fns";
import { getTopAttackers, type TimeWindow, type TopAttackerRow } from "@/lib/ipTimeline";
import { useIpDetail } from "@/contexts/IpDetailContext";
import { useApiData } from "@/hooks/useApiData";
import { fetchTopAttackers } from "@/lib/api";
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

type SortKey =
  | "ip" | "risk_score" | "risk_level" | "total_events" | "bans"
  | "auth_failures" | "crowdsec" | "last_alert_level" | "last_event_type"
  | "country" | "org_name" | "last_seen";
type SortDir = "asc" | "desc" | null;

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "ip", label: "ip" },
  { key: "risk_score", label: "risk" },
  { key: "risk_level", label: "level" },
  { key: "total_events", label: "events" },
  { key: "bans", label: "bans" },
  { key: "auth_failures", label: "auth_fail" },
  { key: "crowdsec", label: "crowdsec" },
  { key: "last_alert_level", label: "alert" },
  { key: "last_event_type", label: "last_event" },
  { key: "country", label: "land" },
  { key: "org_name", label: "organisation" },
  { key: "last_seen", label: "last_seen" },
];

const cellValue = (row: TopAttackerRow, key: SortKey): string => {
  switch (key) {
    case "ip": return row.ip;
    case "risk_score": return String(row.risk_score);
    case "risk_level": return row.risk_level;
    case "total_events": return String(row.total_events);
    case "bans": return String(row.bans);
    case "auth_failures": return String(row.auth_failures);
    case "crowdsec": return String(row.crowdsec);
    case "last_alert_level": return row.last_alert_level || "";
    case "last_event_type": return row.last_event_type || "";
    case "country": return row.country || "";
    case "org_name": return row.org_name || "";
    case "last_seen": return fmt(row.last_seen);
  }
};

const TopAttackersTabbed = () => {
  const [active, setActive] = useState<TimeWindow>("24h");
  const { openIp } = useIpDetail();
  const [sortKey, setSortKey] = useState<SortKey>("risk_score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  // Mock fallback aus dem alten lokalen Aggregator
  const mockRows = useMemo(() => getTopAttackers(active, 100), [active]);

  const { data: apiRows } = useApiData(
    () => fetchTopAttackers<TopAttackerRow>(active, mockRows, 100),
    [active],
    30_000,
  );

  const rows = (apiRows ?? mockRows) as TopAttackerRow[];

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setOpenFilter(null);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const filtered = useMemo(() => {
    return rows.filter((r) =>
      Object.entries(filters).every(([k, search]) => {
        if (!search) return true;
        return cellValue(r, k as SortKey).toLowerCase().includes(search.toLowerCase());
      }),
    );
  }, [rows, filters]);

  const sorted = useMemo(() => {
    if (!sortDir) return filtered;
    const numeric: SortKey[] = ["risk_score", "total_events", "bans", "auth_failures", "crowdsec"];
    return [...filtered].sort((a, b) => {
      let av: string | number;
      let bv: string | number;
      if (sortKey === "last_seen") {
        av = new Date(a.last_seen).getTime();
        bv = new Date(b.last_seen).getTime();
      } else if (numeric.includes(sortKey)) {
        av = Number(cellValue(a, sortKey)) || 0;
        bv = Number(cellValue(b, sortKey)) || 0;
      } else {
        av = cellValue(a, sortKey).toLowerCase();
        bv = cellValue(b, sortKey).toLowerCase();
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

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
        <div className="flex items-center gap-1 mt-2 flex-wrap">
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
            {sorted.length} / {rows.length} IPs · klick für Details
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-0" ref={filterRef}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/20 hover:bg-transparent">
                {COLUMNS.map((col) => {
                  const isActive = sortKey === col.key;
                  const hasFilter = !!filters[col.key];
                  return (
                    <TableHead key={col.key} className="text-xs font-normal text-muted-foreground px-3 py-2 relative whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleSort(col.key)}
                          className="flex items-center gap-1 hover:text-foreground transition-colors"
                        >
                          <span>{col.label}</span>
                          {isActive && sortDir === "desc" && <ChevronDown className="h-3 w-3 text-primary" />}
                          {isActive && sortDir === "asc" && <ChevronUp className="h-3 w-3 text-primary" />}
                        </button>
                        <button
                          onClick={() => setOpenFilter(openFilter === col.key ? null : col.key)}
                          className={`p-0.5 rounded transition-colors ${
                            hasFilter ? "text-primary" : "text-muted-foreground/40 hover:text-muted-foreground"
                          }`}
                        >
                          <Filter className="h-2.5 w-2.5" />
                        </button>
                      </div>
                      {openFilter === col.key && (
                        <div className="absolute top-full left-0 z-20 mt-1 bg-popover border border-border/50 rounded shadow-lg p-2 min-w-[180px]">
                          <input
                            autoFocus
                            type="text"
                            placeholder="Filter value..."
                            value={filters[col.key] || ""}
                            onChange={(e) => setFilters((f) => ({ ...f, [col.key]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === "Escape" || e.key === "Enter") setOpenFilter(null); }}
                            className="w-full bg-background text-foreground text-xs px-2 py-1.5 border border-border/50 rounded outline-none focus:border-primary/50 font-mono"
                          />
                          {filters[col.key] && (
                            <button
                              onClick={() => {
                                setFilters((f) => { const n = { ...f }; delete n[col.key]; return n; });
                                setOpenFilter(null);
                              }}
                              className="text-[10px] text-muted-foreground hover:text-foreground mt-1 block"
                            >
                              Filter zurücksetzen
                            </button>
                          )}
                        </div>
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={COLUMNS.length} className="text-center text-xs text-muted-foreground py-8">
                    Keine Ergebnisse
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((row) => (
                  <TableRow
                    key={row.ip}
                    onClick={() => openIp(row.ip)}
                    className="border-border/10 font-mono text-xs cursor-pointer hover:bg-muted/30 transition-colors"
                  >
                    <TableCell className="px-3 py-2 text-primary hover:underline font-medium">{row.ip}</TableCell>
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
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default TopAttackersTabbed;
