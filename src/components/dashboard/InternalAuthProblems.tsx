import { useState, useMemo, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mockInternalAuthProblems } from "@/data/mockSecurityData";
import { format } from "date-fns";
import { ChevronDown, ChevronUp, Filter, Info } from "lucide-react";

type SortDir = "asc" | "desc" | null;
type SortKey = "ip" | "failed_logins" | "username" | "login_type" | "last_seen" | "organisation" | "land" | "ptr" | "ziel_port";

const InternalAuthProblems = () => {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("failed_logins");
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
    return mockInternalAuthProblems.filter((row) => {
      const vals: Record<string, string> = {
        ip: row.ip, failed_logins: String(row.failed_logins), username: row.username,
        login_type: row.login_type, last_seen: formatTime(row.last_seen),
        organisation: row.organisation, land: row.land, ptr: row.ptr, ziel_port: row.ziel_port,
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
        case "failed_logins": aVal = a.failed_logins; bVal = b.failed_logins; break;
        case "username": aVal = a.username; bVal = b.username; break;
        case "login_type": aVal = a.login_type; bVal = b.login_type; break;
        case "last_seen": aVal = new Date(a.last_seen).getTime(); bVal = new Date(b.last_seen).getTime(); break;
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
    { key: "failed_logins", label: "failed_logins" },
    { key: "username", label: "username" },
    { key: "login_type", label: "login_type" },
    { key: "last_seen", label: "last_seen" },
    { key: "organisation", label: "organisation / ASN" },
    { key: "land", label: "land" },
    { key: "ptr", label: "PTR" },
  ];

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur rounded-none border-0 border-t border-border/30">
      <CardHeader className="px-4 py-2 border-b border-border/30">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-normal text-foreground tracking-wide">
            Interne Passwort-/Client-Probleme last 30days
          </CardTitle>
          <button className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
            <Info className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">Interne Passwort-/Client-Probleme last 30days</p>
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
                <TableRow key={`${row.ip}-${row.username}`} className={`border-border/10 font-mono text-xs hover:bg-muted/30 transition-colors ${i % 2 === 0 ? "bg-transparent" : "bg-muted/10"}`}>
                  <TableCell className="text-foreground px-3 py-2">{row.ip}</TableCell>
                  <TableCell className="text-foreground px-3 py-2">{row.failed_logins.toLocaleString()}</TableCell>
                  <TableCell className="text-muted-foreground px-3 py-2">{row.username}</TableCell>
                  <TableCell className="text-muted-foreground px-3 py-2">{row.login_type}</TableCell>
                  <TableCell className="text-muted-foreground px-3 py-2">{formatTime(row.last_seen)}</TableCell>
                  <TableCell className="text-muted-foreground px-3 py-2">{row.organisation}</TableCell>
                  <TableCell className="text-muted-foreground px-3 py-2">{row.land}</TableCell>
                  <TableCell className="text-muted-foreground px-3 py-2">{row.ptr}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default InternalAuthProblems;
