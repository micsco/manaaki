# Native OIDC login (replacing the fronted Mealie web flow) — design

Date: 2026-09-05

## Problem

The 2026-06-22 auth foundation acquired a per-user Mealie token by fronting
Mealie's *web* OIDC flow. Because that flow hard-codes the return address to
`{base}/login` and keeps OAuth state in a Starlette `session` cookie, manaaki had
to (a) spoof the upstream `Host` header on every proxied request, (b) keep
Mealie's `BASE_URL` unset, (c) pass Mealie's `session` cookie through to the
browser and back, and (d) depend on `X-Forwarded-Proto` being correct end to end.
Each is a coupling to Mealie internals rather than to its API.

## Change

Mealie ≥ 3.23 ships stateless native OIDC endpoints:

- `GET /api/auth/oauth/native/config` → `authorization_endpoint`, `client_id`, `scope`
- `POST /api/auth/oauth/native/token` `{code, code_verifier, redirect_uri, nonce}` → Mealie JWT

manaaki now owns the authorization request:

1. `GET /api/auth/oauth` (own route, no longer proxied): fetch provider config,
   generate `state`, `nonce` and a PKCE verifier, seal them (AES-GCM, same key as
   the session cookie) into `__Host-manaaki_oidc` (HttpOnly, Secure, Lax,
   Max-Age 600), and 302 to the provider with
   `redirect_uri = https://<manaaki-host>/login`.
2. Provider returns to `/login?code&state`; the route redirects to
   `/api/auth/complete` as before.
3. `/api/auth/complete` verifies `state` against the sealed attempt (timing-safe),
   POSTs the code, verifier, redirect URI and nonce to Mealie's native token
   endpoint, seals the returned JWT into the session cookie, and always clears
   the attempt cookie.

## Consequences

- Proxy sends Mealie's own internal `Host`; no impersonation of manaaki's host.
- `/api/auth/oauth*` removed from the anonymous allowlist.
- Mealie `BASE_URL` can (and should) be set to its real public URL.
- Requires Mealie ≥ 3.23. The manaaki `/login` redirect URI stays registered on
  the Google OAuth client, so no IdP change is needed.
- Session refresh: `POST /api/auth/refresh` (Mealie ≥ 3.25), performed once more
  than half the token lifetime has elapsed (sliding session); tokens without
  `iat` fall back to a final-hour window.
