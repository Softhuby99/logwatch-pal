import { useState, useMemo, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { mockAggressiveIPs30Days } from "@/data/mockSecurityData";
import { format } from "date-fns";
import { ChevronDown, ChevronUp, Filter, Info } from "lucide-react";

const levelClass = (level: string): string => {
  if (level === "CRIT") return "bg-red-500/20 text-red-400 border-red-500/30";
  if (level === "WARN") return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  return "bg-muted text-muted-foreground border-border/30";
};

const grundClass = (grund: string): string => {
  const g = grund.toLowerCase();
  if (g.includes("banning") || g.includes("brute")) return "bg-red-500/20 text-red-400 border-red-500/30";
  if (g.includes("unbanning")) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  if (g.includes("improper") || g.includes("non_smtp") || g.includes("warning")) return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  if (g.includes("ssh") || g.includes("http") || g.includes("probe") || g.includes("scan")) return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  if (g.includes("lost_connection")) return "bg-orange-500/20 text-orange-400 border-orange-500/30";
  return "bg-muted text-muted-foreground border-border/30";
};

type SortDir = "asc" | "desc" | null;
type SortKey = "ip" | "treffer" | "level" | "quelle" | "grund" | "konto" | "last_seen" | "letzte_meldung" | "organisation" | "land" | "ptr";

const AggressiveIPs30Days = () => {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("treffer");
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

  const filtered = useMemo(() => {
    return mockAggressiveIPs30Days.filter((row) => {
      const vals: Record<string, string> = {
        ip: row.ip, treffer: String(row.treffer), level: row.level, quelle: row.quelle,
        grund: row.grund, konto: row.konto || "-", last_seen: formatTime(row.last_seen),
        letzte_meldung: row.letzte_meldung, organisation: row.organisation, land: row.land, ptr: row.ptr,
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
        case "treffer": aVal = a.treffer; bVal = b.treffer; break;
        case "level": aVal = a.level; bVal = b.level; break;
        case "quelle": aVal = a.quelle; bVal = b.quelle; break;
        case "grund": aVal = a.grund; bVal = b.grund; break;
        case "konto": aVal = a.konto || ""; bVal = b.konto || ""; break;
        case "last_seen": aVal = new Date(a.last_seen).getTime(); bVal = new Date(b.last_seen).getTime(); break;
        case "letzte_meldung": aVal = a.letzte_meldung; bVal = b.letzte_meldung; break;
        case "organisation": aVal = a.organisation; bVal = b.organisation; break;
        case "land": aVal = a.land; bVal = b.land; break;
        case "ptr": aVal = a.ptr; bVal = b.ptr; break;
      }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const columns: { key: SortKey; label: string }[] = [
    { key: "ip", label: "ip" },
    { key: "treffer", label: "treffer" },
    { key: "level", label: "level" },
    { key: "quelle", label: "quelle" },
    { key: "grund", label: "grund" },
    { key: "konto", label: "konto" },
    { key: "last_seen", label: "last_seen" },
    { key: "letzte_meldung", label: "letzte_meldung" },
    { key: "organisation", label: "organisation / ASN" },
    { key: "land", label: "land" },
    { key: "ptr", label: "PTR" },
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
        <p className="text-xs text-muted-foreground mt-0.5">Top aggressive external IPs (30 Days)</p>
      </CardHeader>

      <CardContent className="p-0" ref={filterRef}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/20 hover:bg-transparent bg-transparent">
                {columns.map((col) => (
                  <TableHead key={col.key} className="text-xs font-normal text-muted-foreground px-3 py-2 relative">
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
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground text-xs py-8">Keine Ergebnisse</TableCell></TableRow>
              ) : sorted.map((row, i) => (
                <TableRow key={row.ip} className={`border-border/10 font-mono text-xs hover:bg-muted/30 transition-colors ${i % 2 === 0 ? "bg-transparent" : "bg-muted/10"}`}>
                  <TableCell className="text-foreground px-3 py-2">{row.ip}</TableCell>
                  <TableCell className="text-foreground px-3 py-2">{row.treffer}</TableCell>
                  <TableCell className="px-3 py-2">
                    <Badge variant="outline" className={`text-[10px] px-1.5 font-mono ${levelClass(row.level)}`}>{row.level}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground px-3 py-2">{row.quelle}</TableCell>
                  <TableCell className="px-3 py-2">
                    <Badge variant="outline" className={`text-[10px] px-1.5 font-mono ${grundClass(row.grund)}`}>{row.grund}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground px-3 py-2">{row.konto || "-"}</TableCell>
                  <TableCell className="text-muted-foreground px-3 py-2">{formatTime(row.last_seen)}</TableCell>
                  <TableCell className="text-muted-foreground px-3 py-2 max-w-[400px] truncate">{row.letzte_meldung}</TableCell>
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
