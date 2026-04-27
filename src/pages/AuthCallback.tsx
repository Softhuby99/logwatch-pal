import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function AuthCallback() {
  const { handleCallback } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await handleCallback();
        navigate("/", { replace: true });
      } catch (err) {
        console.error("[auth] callback failed", err);
        setError(err instanceof Error ? err.message : "Login fehlgeschlagen");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center gap-3 text-center">
        {error ? (
          <>
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <p className="max-w-sm text-sm text-muted-foreground">{error}</p>
            <button
              className="text-sm text-primary underline"
              onClick={() => navigate("/login", { replace: true })}
            >
              Zurück zur Anmeldung
            </button>
          </>
        ) : (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Anmeldung wird abgeschlossen…</p>
          </>
        )}
      </div>
    </div>
  );
}
