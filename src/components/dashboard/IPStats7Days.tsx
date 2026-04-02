import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { mockIPSummary } from "@/data/mockSecurityData";
import { format } from "date-fns";
import { Filter, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

type SortDir = "asc" | "desc" | null;
type SortKey = "ip" | "total_events" | "first_seen" | "last_seen" | "last_target_email" | "last_event_type";

const IPStats7Days = () => {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("total_events");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const formatTime = (iso: string) => {
    try {
      return format(new Date(iso), "yyyy-MM-dd HH:mm:ss");
    } catch {
      return iso;
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : sortDir === "desc" ? null : "asc");
      if (sortDir === null) setSortKey("total_events");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const filtered = useMemo(() => {
    return mockIPSummary.filter((row) => {
      const vals: Record<string, string> = {
        ip: row.ip,
        total_events: String(row.total_events),
        first_seen: formatTime(row.first_seen),
        last_seen: formatTime(row.last_seen),
        last_target_email: row.last_target_email || "–",
        last_event_type: row.last_event_type,
      };
      return Object.entries(filters).every(([key, search]) => {
        if (!search) return true;
        return vals[key]?.toLowerCase().includes(search.toLowerCase());
      });
    });
  }, [filters]);

  const sorted = useMemo(() => {
    if (!sortDir) return filtered;
    return [...filtered].sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";
      switch (sortKey) {
        case "ip": aVal = a.ip; bVal = b.ip; break;
        case "total_events": aVal = a.total_events; bVal = b.total_events; break;
        case "first_seen": aVal = new Date(a.first_seen).getTime(); bVal = new Date(b.first_seen).getTime(); break;
        case "last_seen": aVal = new Date(a.last_seen).getTime(); bVal = new Date(b.last_seen).getTime(); break;
        case "last_target_email": aVal = a.last_target_email || ""; bVal = b.last_target_email || ""; break;
        case "last_event_type": aVal = a.last_event_type; bVal = b.last_event_type; break;
      }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const columns: { key: SortKey; label: string; align?: string }[] = [
    { key: "ip", label: "ip" },
    { key: "total_events", label: "treffer", align: "text-right" },
    { key: "first_seen", label: "erstes_auftreten" },
    { key: "last_seen", label: "letztes_auftreten" },
    { key: "last_target_email", label: "haeufigstes_zielkonto" },
    { key: "last_event_type", label: "haeufigster_grund" },
  ];

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col || !sortDir) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

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
                {columns.map((col) => (
                  <TableHead key={col.key} className={`text-xs ${col.align || ""}`}>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleSort(col.key)}
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        {col.label}
                        <SortIcon col={col.key} />
                      </button>
                      <button
                        onClick={() => setOpenFilter(openFilter === col.key ? null : col.key)}
                        className={`p-0.5 rounded hover:bg-muted transition-colors ${
                          filters[col.key] ? "text-primary" : "text-muted-foreground opacity-50 hover:opacity-100"
                        }`}
                      >
                        <Filter className="h-3 w-3" />
                      </button>
                    </div>
                    {openFilter === col.key && (
                      <div className="mt-1">
                        <Input
                          autoFocus
                          placeholder="Filter..."
                          value={filters[col.key] || ""}
                          onChange={(e) =>
                            setFilters((f) => ({ ...f, [col.key]: e.target.value }))
                          }
                          onKeyDown={(e) => e.key === "Escape" && setOpenFilter(null)}
                          className="h-6 text-xs bg-background border-border/50 font-sans"
                        />
                      </div>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground text-xs py-8">
                    Keine Ergebnisse für diesen Filter
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((ip) => (
                  <TableRow key={ip.ip} className="border-border/20 font-mono text-xs">
                    <TableCell className="text-foreground font-medium">{ip.ip}</TableCell>
                    <TableCell className="text-right">{ip.total_events}</TableCell>
                    <TableCell className="text-muted-foreground">{formatTime(ip.first_seen)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatTime(ip.last_seen)}</TableCell>
                    <TableCell className="text-muted-foreground">{ip.last_target_email || "–"}</TableCell>
                    <TableCell className="text-muted-foreground">{ip.last_event_type}</TableCell>
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

export default IPStats7Days;
