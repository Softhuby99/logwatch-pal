import { useState, useMemo, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { mockIPSummary } from "@/data/mockSecurityData";
import { format } from "date-fns";
import { ChevronDown, ChevronUp, Filter, Info } from "lucide-react";

const eventTypeColor = (type: string): string => {
  const t = type.toLowerCase();
  if (t.includes("brute") || t.includes("ban")) return "destructive";
  if (t.includes("auth") || t.includes("login_failed") || t.includes("password")) return "default";
  if (t.includes("scan") || t.includes("probe") || t.includes("crawl")) return "secondary";
  return "outline";
};

const eventTypeClass = (type: string): string => {
  const t = type.toLowerCase();
  if (t.includes("brute") || t.includes("ban")) return "bg-red-500/20 text-red-400 border-red-500/30";
  if (t.includes("auth") || t.includes("login_failed") || t.includes("password")) return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  if (t.includes("scan") || t.includes("probe") || t.includes("crawl")) return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  return "bg-muted text-muted-foreground border-border/30";
};

type SortDir = "asc" | "desc" | null;
type SortKey = "ip" | "total_events" | "first_seen" | "last_seen" | "last_target_email" | "last_event_type";

const IPStats7Days = () => {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("total_events");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const filterRef = useRef<HTMLDivElement>(null);

  // Close filter dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setOpenFilter(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const formatTime = (iso: string) => {
    try {
      return format(new Date(iso), "yyyy-MM-dd HH:mm:ss");
    } catch {
      return iso;
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
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
        last_target_email: row.last_target_email || "-",
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

  const columns: { key: SortKey; label: string }[] = [
    { key: "ip", label: "ip" },
    { key: "total_events", label: "treffer" },
    { key: "first_seen", label: "erstes_auftreten" },
    { key: "last_seen", label: "letztes_auftreten" },
    { key: "last_target_email", label: "haeufigstes_zielkonto" },
    { key: "last_event_type", label: "haeufigster_grund" },
  ];

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur rounded-none border-0 border-t border-border/30">
      {/* Grafana-style panel header */}
      <CardHeader className="px-4 py-2 border-b border-border/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-normal text-foreground tracking-wide">
              Statistik nach IP 7 Tage
            </CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <button className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
              <Info className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {/* Subtitle / description bar like Grafana */}
        <p className="text-xs text-muted-foreground mt-0.5">Statistik nach IP 7 Tage</p>
      </CardHeader>

      <CardContent className="p-0" ref={filterRef}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/20 hover:bg-transparent bg-transparent">
                {columns.map((col) => {
                  const isActive = sortKey === col.key;
                  const hasFilter = !!filters[col.key];

                  return (
                    <TableHead key={col.key} className="text-xs font-normal text-muted-foreground px-3 py-2 relative">
                      <div className="flex items-center gap-1.5">
                        {/* Column label + sort */}
                        <button
                          onClick={() => handleSort(col.key)}
                          className="flex items-center gap-1 hover:text-foreground transition-colors group"
                        >
                          <span>{col.label}</span>
                          {isActive && sortDir === "desc" && (
                            <ChevronDown className="h-3 w-3 text-primary" />
                          )}
                          {isActive && sortDir === "asc" && (
                            <ChevronUp className="h-3 w-3 text-primary" />
                          )}
                        </button>

                        {/* Filter icon (Grafana-style funnel) */}
                        <button
                          onClick={() => setOpenFilter(openFilter === col.key ? null : col.key)}
                          className={`p-0.5 rounded transition-colors ${
                            hasFilter
                              ? "text-primary"
                              : "text-muted-foreground/40 hover:text-muted-foreground"
                          }`}
                        >
                          <Filter className="h-2.5 w-2.5" />
                        </button>
                      </div>

                      {/* Filter dropdown */}
                      {openFilter === col.key && (
                        <div className="absolute top-full left-0 z-20 mt-1 bg-popover border border-border/50 rounded shadow-lg p-2 min-w-[180px]">
                          <input
                            autoFocus
                            type="text"
                            placeholder="Filter value..."
                            value={filters[col.key] || ""}
                            onChange={(e) =>
                              setFilters((f) => ({ ...f, [col.key]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Escape") setOpenFilter(null);
                              if (e.key === "Enter") setOpenFilter(null);
                            }}
                            className="w-full bg-background text-foreground text-xs px-2 py-1.5 border border-border/50 rounded outline-none focus:border-primary/50 font-mono"
                          />
                          {filters[col.key] && (
                            <button
                              onClick={() => {
                                setFilters((f) => {
                                  const next = { ...f };
                                  delete next[col.key];
                                  return next;
                                });
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
                  <TableCell colSpan={6} className="text-center text-muted-foreground text-xs py-8">
                    Keine Ergebnisse
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((ip, i) => (
                  <TableRow
                    key={ip.ip}
                    className={`border-border/10 font-mono text-xs hover:bg-muted/30 transition-colors ${
                      i % 2 === 0 ? "bg-transparent" : "bg-muted/10"
                    }`}
                  >
                    <TableCell className="text-foreground px-3 py-2">{ip.ip}</TableCell>
                    <TableCell className="text-foreground px-3 py-2">{ip.total_events}</TableCell>
                    <TableCell className="text-muted-foreground px-3 py-2">{formatTime(ip.first_seen)}</TableCell>
                    <TableCell className="text-muted-foreground px-3 py-2">{formatTime(ip.last_seen)}</TableCell>
                    <TableCell className="text-muted-foreground px-3 py-2">{ip.last_target_email || "-"}</TableCell>
                    <TableCell className="px-3 py-2">
                      <Badge variant="outline" className={`text-[10px] px-1.5 font-mono ${eventTypeClass(ip.last_event_type)}`}>
                        {ip.last_event_type}
                      </Badge>
                    </TableCell>
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
