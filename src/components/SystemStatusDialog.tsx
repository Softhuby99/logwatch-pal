import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, MinusCircle, RefreshCw, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fetchHealthChecks, type HealthResponse, type HealthCheck } from "@/lib/api";

interface Props { open: boolean; onOpenChange: (v: boolean) => void; }

const FALLBACK: HealthResponse = {
  overall: "warn",
  checked_at: new Date().toISOString(),
  checks: [
    { id: "api", label: "Dashboard API", status: "skip", detail: "API nicht erreichbar (Demo-Modus)" },
  ],
};

const StatusIcon = ({ s }: { s: HealthCheck["status"] }) => {
  if (s === "ok") return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  if (s === "warn") return <AlertTriangle className="h-4 w-4 text-amber-400" />;
  if (s === "error") return <XCircle className="h-4 w-4 text-red-400" />;
  return <MinusCircle className="h-4 w-4 text-muted-foreground" />;
};

const statusLabel: Record<HealthCheck["status"], string> = {
  ok: "OK", warn: "WARN", error: "FEHLER", skip: "n/a",
};

export const SystemStatusDialog = ({ open, onOpenChange }: Props) => {
  const [data, setData] = useState<HealthResponse>(FALLBACK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await fetchHealthChecks(FALLBACK);
    setData(data);
    setLoading(false);
  }, []);

  useEffect(() => { if (open) load(); }, [open, load]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <DialogTitle className="flex items-center gap-2">
                System Status
                <Badge variant="outline" className={
                  data.overall === "ok" ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                  : data.overall === "warn" ? "border-amber-500/40 text-amber-400 bg-amber-500/10"
                  : "border-red-500/40 text-red-400 bg-red-500/10"
                }>
                  {data.overall.toUpperCase()}
                </Badge>
              </DialogTitle>
              <DialogDescription>
                Letzte Prüfung: {new Date(data.checked_at).toLocaleString("de-DE")}
                {data.cached ? " (cached)" : ""}
              </DialogDescription>
            </div>
            <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Jetzt prüfen
            </Button>
          </div>
        </DialogHeader>

        <div className="divide-y divide-border/60 rounded-md border border-border/60 bg-background/40">
          {data.checks.map((c) => (
            <div key={c.id} className="px-4 py-3 flex items-start gap-3">
              <StatusIcon s={c.status} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">{c.label}</p>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {statusLabel[c.status]}{c.latency_ms != null ? ` · ${c.latency_ms}ms` : ""}
                  </span>
                </div>
                {c.detail && <p className="text-xs text-muted-foreground mt-0.5 break-all">{c.detail}</p>}
                {c.children && c.children.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {c.children.map((ch) => (
                      <li key={ch.target} className="text-[11px] flex items-center gap-2">
                        {ch.ok ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <XCircle className="h-3 w-3 text-red-400" />}
                        <span className="font-mono">{ch.target}</span>
                        <span className="text-muted-foreground">— {ch.detail} ({ch.latency_ms}ms)</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-muted-foreground">
          Konfiguration über ENV: <code>OPNSENSE_URL/KEY/SECRET</code>, <code>MAILCOW_URL/API_KEY</code>,{" "}
          <code>SSH_TARGETS</code> (user@host,user@host), <code>SSH_KEY_PATH</code>, <code>CROWDSEC_LAPI_URL</code>.
          Nicht konfigurierte Checks erscheinen als „n/a".
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default SystemStatusDialog;
