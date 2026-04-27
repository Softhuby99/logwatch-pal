import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Shield, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { authConfig, type SsoProvider } from "@/lib/authConfig";
import { GoogleIcon, MicrosoftIcon, SamlIcon, OidcIcon } from "@/components/auth/SsoIcons";
import { toast } from "sonner";

interface ProviderDef {
  id: SsoProvider;
  label: string;
  icon: React.ReactNode;
}

const PROVIDERS: ProviderDef[] = [
  { id: "google", label: "Continue with Google", icon: <GoogleIcon /> },
  { id: "microsoft", label: "Continue with Microsoft", icon: <MicrosoftIcon /> },
  { id: "saml", label: "SAML Single Sign-On", icon: <SamlIcon className="text-primary" /> },
  { id: "oidc", label: "OIDC Single Sign-On", icon: <OidcIcon className="text-primary" /> },
];

export default function Login() {
  const { user, loginWithProvider, loginWithPassword, loading } = useAuth();
  const location = useLocation();
  const [pending, setPending] = useState<SsoProvider | "password" | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const from = (location.state as { from?: string } | null)?.from ?? "/";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (user) return <Navigate to={from} replace />;

  const handleSso = async (p: SsoProvider) => {
    setPending(p);
    try {
      await loginWithProvider(p);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login fehlgeschlagen");
      setPending(null);
    }
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending("password");
    try {
      await loginWithPassword(email, password);
      toast.success("Demo-Login aktiv");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login fehlgeschlagen");
    } finally {
      setPending(null);
    }
  };

  const enabledProviders = PROVIDERS.filter((p) => authConfig.providers[p.id]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Security Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Anmeldung über Single Sign-On
          </p>
        </div>

        {enabledProviders.length > 0 && (
          <div className="space-y-2">
            {enabledProviders.map((p) => (
              <Button
                key={p.id}
                variant="outline"
                className="w-full justify-start gap-3"
                disabled={!!pending}
                onClick={() => handleSso(p.id)}
              >
                {pending === p.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  p.icon
                )}
                <span>{p.label}</span>
              </Button>
            ))}
          </div>
        )}

        {authConfig.passwordEnabled && (
          <>
            <div className="relative">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs uppercase text-muted-foreground">
                oder
              </span>
            </div>
            <form className="space-y-3" onSubmit={handlePassword}>
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="password">Passwort</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full gap-2" disabled={!!pending}>
                {pending === "password" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                Anmelden
              </Button>
            </form>
          </>
        )}

        {!authConfig.authority && (
          <p className="rounded-md border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <strong>Hinweis:</strong> Es ist noch kein OIDC-Provider konfiguriert.
            SSO-Buttons öffnen erst Authentik, sobald{" "}
            <code className="rounded bg-muted px-1">VITE_OIDC_AUTHORITY</code>{" "}
            gesetzt ist (siehe Setup-Wizard).
          </p>
        )}
      </div>
    </div>
  );
}
