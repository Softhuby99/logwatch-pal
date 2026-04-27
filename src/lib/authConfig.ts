/**
 * SSO / Authentik configuration.
 *
 * All values come from environment variables so the same build can be deployed
 * against any Authentik instance. Configure them via the Setup-Wizard (writes
 * to `.env`) or directly in your `.env` file.
 *
 *   VITE_AUTH_REQUIRED        – "true" forces the login wall (default: false in preview)
 *   VITE_OIDC_AUTHORITY       – e.g. https://auth.example.com/application/o/dashboard/
 *   VITE_OIDC_CLIENT_ID       – Authentik provider client-id
 *   VITE_OIDC_REDIRECT_URI    – e.g. https://dashboard.example.com/auth/callback
 *   VITE_OIDC_POST_LOGOUT_URI – e.g. https://dashboard.example.com/login
 *   VITE_OIDC_SCOPE           – default "openid profile email offline_access"
 *
 *   VITE_SSO_GOOGLE_ENABLED   – "true" to show Google button
 *   VITE_SSO_MICROSOFT_ENABLED– "true" to show Microsoft button
 *   VITE_SSO_SAML_ENABLED     – "true" to show SAML SSO button
 *   VITE_SSO_OIDC_ENABLED     – "true" to show generic OIDC button
 *   VITE_SSO_PASSWORD_ENABLED – "true" (default) to show email/password form
 *
 * Each provider is realised in Authentik as a separate "application + provider"
 * pair. We pass `kc_idp_hint` style hints via the `acr_values` parameter so
 * Authentik routes the user to the right upstream IdP without an extra click.
 */

export type SsoProvider = "google" | "microsoft" | "saml" | "oidc";

export interface AuthConfig {
  authRequired: boolean;
  authority: string;
  clientId: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
  scope: string;
  providers: Record<SsoProvider, boolean>;
  passwordEnabled: boolean;
}

const env = import.meta.env;

const bool = (v: unknown, fallback = false) =>
  v === undefined || v === "" ? fallback : String(v).toLowerCase() === "true";

export const authConfig: AuthConfig = {
  authRequired: bool(env.VITE_AUTH_REQUIRED, false),
  authority: env.VITE_OIDC_AUTHORITY ?? "",
  clientId: env.VITE_OIDC_CLIENT_ID ?? "dashboard",
  redirectUri:
    env.VITE_OIDC_REDIRECT_URI ??
    (typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback`
      : ""),
  postLogoutRedirectUri:
    env.VITE_OIDC_POST_LOGOUT_URI ??
    (typeof window !== "undefined"
      ? `${window.location.origin}/login`
      : ""),
  scope: env.VITE_OIDC_SCOPE ?? "openid profile email offline_access",
  providers: {
    google: bool(env.VITE_SSO_GOOGLE_ENABLED, true),
    microsoft: bool(env.VITE_SSO_MICROSOFT_ENABLED, true),
    saml: bool(env.VITE_SSO_SAML_ENABLED, true),
    oidc: bool(env.VITE_SSO_OIDC_ENABLED, true),
  },
  passwordEnabled: bool(env.VITE_SSO_PASSWORD_ENABLED, true),
};

/**
 * The Authentik OIDC provider exposes one OAuth2/OIDC endpoint. To force a
 * specific upstream Identity Provider (Google federation, Microsoft federation
 * or a SAML source) we send a custom `provider` query parameter. Authentik's
 * flow stage `default-source-enrollment` reads it via expression policy.
 *
 * If you keep Authentik defaults, the parameter is harmless — the user just
 * sees the normal Authentik login page.
 */
export function providerHint(provider: SsoProvider): Record<string, string> {
  return { provider_hint: provider };
}
