# Single Sign-On mit Authentik

Das Dashboard spricht ausschließlich **OIDC** gegen Authentik. Authentik selbst
übernimmt die Federation zu Google, Microsoft (Entra ID) und beliebigen
SAML-IdPs. Der Vorteil: in der Dashboard-Konfiguration steht nur **eine**
Issuer-URL — alles weitere wird in Authentik geklickt.

## 1. Erstmaliger Login

Nach `docker compose up -d` ist Authentik unter `https://<HOSTNAME>/auth/`
erreichbar. Der initiale Bootstrap-Token / Admin-Passwort steht in den Logs:

```bash
docker compose logs authentik | grep -i "akadmin"
```

Setze danach in der Authentik-UI ein eigenes Admin-Passwort.

## 2. OIDC-Provider für das Dashboard

Der mitgelieferte Blueprint
(`authentik/blueprints/dashboard-oidc.yaml`) legt automatisch an:

- **Provider** `dashboard-oidc` (Authorization-Code + PKCE)
- **Application** `dashboard` mit Slug `dashboard`
- Redirect URIs: `https://<HOSTNAME>/auth/callback` und `http://<HOSTNAME>/auth/callback`
- Scopes: `openid profile email offline_access`

Das Client-Secret wird beim ersten Start generiert. Du findest es unter
**Applications → Providers → dashboard-oidc → Edit**. Trage es in deine `.env`
als `OIDC_CLIENT_SECRET=…` ein und starte neu.

## 3. Federated Identity Sources

### Google
1. Google Cloud Console → APIs & Services → Credentials → **Create OAuth Client ID** → Web application
2. Authorized redirect URI: `https://<HOSTNAME>/auth/source/oauth/callback/google/`
3. In Authentik: **Directory → Federation & Social login → Create → Google OAuth Source**
   - Consumer key/secret aus Schritt 1
   - Slug: `google`
4. **Flows → default-source-authentication** so anpassen, dass die Source auf der
   Login-Seite erscheint (per default schon konfiguriert)

### Microsoft / Entra ID
1. Entra Admin Center → App registrations → **New registration**
2. Redirect URI (Web): `https://<HOSTNAME>/auth/source/oauth/callback/azuread/`
3. In Authentik: **Create → Azure AD OAuth Source**
   - Tenant ID, Client ID, Client Secret eintragen
   - Slug: `microsoft`

### SAML (z.B. Okta, ADFS, eigener IdP)
1. In Authentik: **Create → SAML Source**
   - Slug: `saml`
   - SSO-URL und IdP-Cert aus deinem IdP eintragen
2. SP-Metadata exportieren: **Source → SAML → Metadata**
3. Diese Metadata in deinem IdP als neue SP-Anwendung hinterlegen

### Generischer OIDC
1. In Authentik: **Create → OAuth/OIDC Source**, OIDC Discovery URL des
   Fremd-Providers eintragen, Slug: `oidc`

## 4. Buttons im Dashboard

Die Schalter im **Setup-Wizard → SSO** entscheiden nur, welche Buttons auf
`/login` angezeigt werden. Damit ein Klick auf z.B. „Continue with Google" auch
direkt zur Google-Federation springt, muss der Slug der Source in Authentik
exakt `google` / `microsoft` / `saml` / `oidc` heißen — der Dashboard-Code sendet
diesen Wert als `provider_hint` Parameter mit.

## 5. Erste Anmeldung erzwingen

Setze in `.env`:

```
VITE_AUTH_REQUIRED=true
```

und baue die App neu (`docker compose build dashboard && docker compose up -d`).
