import { useState } from "react";
import { Loader2, Play, Terminal } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { useRefreshSettings } from "@/contexts/RefreshSettingsContext";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || "/api";

interface ToolDef {
  id: string;
  label: string;
  description: string;
}

const KNOWN_TOOLS: ToolDef[] = [
  {
    id: "ip_enricher",
    label: "IP Enricher (GeoIP / ASN nachladen)",
    description:
      "Lädt fehlende GeoIP-, ASN- und Org-Infos für IPs ohne Enrichment nach.",
  },
  {
    id: "risk_score",
    label: "Risk-Score neu berechnen",
    description: "Berechnet den Risiko-Score für alle bekannten IPs neu.",
  },
  {
    id: "ip_summary",
    label: "IP-Summary aktualisieren",
    description: "Aktualisiert die ip_summary-Aggregat-Tabelle.",
  },
];

interface RunResult {
  id: string;
  exit_code: number;
  ok: boolean;
  stdout: string;
  stderr: string;
}

export const ToolsDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) => {
  const { refreshMs, setRefreshMs } = useRefreshSettings();
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const seconds = Math.round(refreshMs / 1000);

  const runTool = async (id: string) => {
    setRunning(id);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/tools/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = (await res.json()) as RunResult;
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="h-4 w-4" /> Tools & Einstellungen
          </DialogTitle>
          <DialogDescription>
            Refresh-Rate des Dashboards anpassen und Wartungs-Skripte manuell
            anstoßen.
          </DialogDescription>
        </DialogHeader>

        {/* Refresh rate */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Refresh-Rate</Label>
            <span className="text-xs text-muted-foreground tabular-nums">
              {seconds}s
            </span>
          </div>
          <Slider
            min={5}
            max={300}
            step={5}
            value={[seconds]}
            onValueChange={(v) => setRefreshMs(v[0] * 1000)}
          />
          <p className="text-[11px] text-muted-foreground">
            Intervall, in dem alle Dashboard-Panels die API neu abfragen
            (5–300 Sekunden).
          </p>
        </div>

        <Separator />

        {/* Scripts */}
        <div className="space-y-2">
          <Label className="text-sm">Wartungs-Skripte</Label>
          <div className="space-y-2">
            {KNOWN_TOOLS.map((t) => (
              <div
                key={t.id}
                className="flex items-start justify-between gap-3 rounded-md border border-border/60 bg-muted/20 p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t.description}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!!running}
                  onClick={() => runTool(t.id)}
                >
                  {running === t.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  Start
                </Button>
              </div>
            ))}
          </div>
        </div>

        {(result || error) && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Ergebnis {result ? `(exit ${result.exit_code})` : ""}
            </Label>
            <pre className="max-h-56 overflow-auto rounded-md bg-black/40 p-3 text-[11px] leading-snug text-muted-foreground whitespace-pre-wrap break-all">
              {error
                ? `FEHLER: ${error}`
                : `${result?.stdout || ""}${
                    result?.stderr ? `\n--- stderr ---\n${result.stderr}` : ""
                  }`}
            </pre>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Schließen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ToolsDialog;
