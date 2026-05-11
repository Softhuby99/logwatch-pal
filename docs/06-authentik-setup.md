# 06 – Authentik-Setup

Authentik läuft als **separate VM** unter `https://sso.servuswir.de:9443` und stellt SSO/OIDC für das Dashboard bereit.

## 6.1 Erst-Login

1. Browser → `https://sso.servuswir.de:9443/if/flow/initial-setup/`
2. `akadmin`-Passwort setzen
3. **MFA aktivieren**: Directory → Users → akadmin → MFA Authenticators → TOTP

## 6.2 OIDC-Provider anlegen

**Applications → Providers → Create → OAuth2/OpenID Provider**

| Feld | Wert |
|------|------|
| Name | `dashboard-oidc` |
| Authorization flow | `default-provider-authorization-implicit-consent` |
| Client type | **Public** (PKCE) |
| Client ID | `dashboard` (oder generieren lassen → in `.env` übernehmen) |
| Client Secret | bei Public leer |
| Redirect URIs | `https://logdash.servuswir.de/auth/callback` |
| Signing Key | `authentik Self-signed Certificate` |
| Subject mode | `Based on the User's hashed ID` |
| Include claims in id_token | ✔ |
| Scopes | `openid`, `profile`, `email`, `offline_access` |

→ **Save**. Der Client-ID-Wert kommt in `OIDC_CLIENT_ID` und `VITE_OIDC_CLIENT_ID`.

## 6.3 Application anlegen

**Applications → Applications → Create**

| Feld | Wert |
|------|------|
| Name | `LogWatch Dashboard` |
| Slug | `log-dashboard` |
| Provider | `dashboard-oidc` |
| Launch URL | `https://logdash.servuswir.de/` |

⚠️ Der **Slug** bestimmt die Discovery-URL:

```
https://sso.servuswir.de:9443/application/o/log-dashboard/.well-known/openid-configuration
```

→ Diese Basis kommt in `VITE_OIDC_AUTHORITY`:

```
VITE_OIDC_AUTHORITY=https://sso.servuswir.de:9443/application/o/log-dashboard/
```

## 6.4 User-/Gruppen-Bindings

**Directory → Groups → Create** → `dashboard-users`. User dieser Gruppe hinzufügen.

**Applications → LogWatch Dashboard → Policy / Group / User Bindings → Bind existing group** → `dashboard-users`.

## 6.5 Federation-Sources (optional)

**Directory → Federation & Social login → Create**

### Google

| Feld | Wert |
|------|------|
| Provider | Google |
| Consumer Key | aus Google Cloud Console (OAuth Client) |
| Consumer Secret | dito |

→ Redirect-URI in Google Console: `https://sso.servuswir.de:9443/source/oauth/callback/google/`

### Microsoft / Entra ID

| Feld | Wert |
|------|------|
| Provider | Azure AD |
| Consumer Key | App-Registration → Application (client) ID |
| Consumer Secret | Client Secret |

→ Redirect-URI in Entra: `https://sso.servuswir.de:9443/source/oauth/callback/azure-ad/`

### SAML

Für SAML Identity Provider analog – Authentik liefert SP-Metadata zum Download.

## 6.6 Property-Mappings (optional, für RBAC)

Wenn Gruppen-basierte Rechte im Dashboard genutzt werden sollen:

**Customization → Property Mappings → Create → Scope Mapping**

```python
return {
  "groups": [g.name for g in user.ak_groups.all()],
}
```

Scope-Name: `groups`. Im Provider unter **Scopes** zusätzlich `groups` aktivieren.

## 6.7 Verifikation

```bash
# Discovery-Dokument
curl -s https://sso.servuswir.de:9443/application/o/log-dashboard/.well-known/openid-configuration | jq .

# Endpoints sichtbar?
curl -s https://sso.servuswir.de:9443/application/o/log-dashboard/.well-known/openid-configuration \
  | jq '.authorization_endpoint, .token_endpoint, .jwks_uri'
```

Anschließend Browser-Test:

1. `https://logdash.servuswir.de/` → 302 zu Authentik
2. Login → 302 zurück nach `/auth/callback?code=...`
3. Dashboard zeigt User-Avatar oben rechts

## 6.8 Häufige Fehler

| Symptom | Ursache | Fix |
|---------|---------|-----|
| `redirect_uri does not match` | Redirect-URI im Provider stimmt nicht 1:1 | exakte Schreibweise prüfen, kein trailing slash |
| `invalid_client` | falsche Client-ID oder Confidential vs. Public | Client-Type auf Public, Secret leer |
| Endlos-Redirect | Clock-Skew | NTP auf beiden VMs |
| `404` auf Discovery | falscher Slug | Application-Slug = `log-dashboard` |
