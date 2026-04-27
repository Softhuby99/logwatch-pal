import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { UserManager, WebStorageStateStore, type User } from "oidc-client-ts";
import { authConfig, providerHint, type SsoProvider } from "@/lib/authConfig";

interface DemoUser {
  kind: "demo";
  email: string;
  name: string;
}

interface OidcUser {
  kind: "oidc";
  email: string;
  name: string;
  raw: User;
}

export type SessionUser = DemoUser | OidcUser;

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  authRequired: boolean;
  loginWithProvider: (provider: SsoProvider) => Promise<void>;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  handleCallback: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const DEMO_KEY = "dashboard.demoSession";

function buildUserManager() {
  if (!authConfig.authority) return null;
  return new UserManager({
    authority: authConfig.authority,
    client_id: authConfig.clientId,
    redirect_uri: authConfig.redirectUri,
    post_logout_redirect_uri: authConfig.postLogoutRedirectUri,
    scope: authConfig.scope,
    response_type: "code",
    loadUserInfo: true,
    userStore: new WebStorageStateStore({ store: window.localStorage }),
  });
}

function toSession(u: User): OidcUser {
  const profile = u.profile ?? {};
  return {
    kind: "oidc",
    email: (profile.email as string) ?? "",
    name: (profile.name as string) ?? (profile.preferred_username as string) ?? "Unknown",
    raw: u,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const userManager = useMemo(buildUserManager, []);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Demo / local session first
        const raw = localStorage.getItem(DEMO_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as DemoUser;
          if (!cancelled) setUser(parsed);
        } else if (userManager) {
          const u = await userManager.getUser();
          if (!cancelled && u && !u.expired) setUser(toSession(u));
        }
      } catch (err) {
        console.warn("[auth] init failed", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userManager]);

  const loginWithProvider = async (provider: SsoProvider) => {
    if (!userManager) {
      throw new Error(
        "OIDC nicht konfiguriert. Bitte VITE_OIDC_AUTHORITY und VITE_OIDC_CLIENT_ID setzen.",
      );
    }
    await userManager.signinRedirect({
      extraQueryParams: providerHint(provider),
    });
  };

  const loginWithPassword = async (email: string, password: string) => {
    // Demo-only path so the UI is testable without a running Authentik.
    // Real password login happens through Authentik's hosted flow.
    if (!email || !password) throw new Error("Email und Passwort erforderlich");
    const session: DemoUser = {
      kind: "demo",
      email,
      name: email.split("@")[0],
    };
    localStorage.setItem(DEMO_KEY, JSON.stringify(session));
    setUser(session);
  };

  const handleCallback = async () => {
    if (!userManager) throw new Error("OIDC nicht konfiguriert");
    const u = await userManager.signinRedirectCallback();
    setUser(toSession(u));
  };

  const logout = async () => {
    localStorage.removeItem(DEMO_KEY);
    setUser(null);
    if (userManager) {
      try {
        await userManager.signoutRedirect();
      } catch {
        await userManager.removeUser();
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authRequired: authConfig.authRequired,
        loginWithProvider,
        loginWithPassword,
        handleCallback,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
