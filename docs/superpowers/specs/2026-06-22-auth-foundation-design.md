# Auth foundation + public/private split — design

Date: 2026-06-22

## Problem

manaaki is currently a single-tier app: every visitor acts as the *same* Mealie
user via one shared, server-side API token (injected by the Vite proxy in dev
and nginx in prod). There is no concept of "who is using the app." This blocks
the product direction:

- manaaki should become the **primary front door** to Mealie for multiple
  households, because Mealie's own UI is the adoption blocker.
- **Recipes should be browsable by anyone** (the public draw), but
  **personal/household features** — meal planner, meal history, shopping list
  builder — should be available **only to logged-in members**, scoped to *their*
  household.

Mealie hosts **multiple households**, and it scopes all data by the logged-in
user's group/household. A single shared token therefore cannot serve
household-specific data: we need **per-user identity**.

This spec covers the **auth foundation + public/private split only**. Meal
history and the shopping list builder are deliberately out of scope here — each
becomes its own spec once this boundary exists. The existing (navigation-only)
`/plan` view is in scope insofar as it gets gated and surfaced; its features are
not expanded here.

## Goals

- Introduce a real auth boundary: **anonymous** vs **authenticated** access.
- Authentication is delegated entirely to **Mealie via Google OIDC** (Mealie is
  the identity provider). manaaki never stores passwords or implements auth
  logic of its own.
- A logged-in user's Mealie token is **never exposed to browser JavaScript**
  (defends against the recipe-content XSS surface — recipe instructions/notes
  are user-authored HTML/markdown rendered in the app).
- Per-user data scoping "just works" — each Google identity resolves to its own
  Mealie user, hence the correct household.
- Deployable as a single container on Dokploy behind Traefik.

## Non-goals (deferred)

- Meal history feature (own spec).
- Shopping list builder feature (own spec).
- Per-feature role gating beyond authenticated/anonymous (Mealie's `canManage`
  etc. ride along via `/api/users/self` and can be used later).
- Public browsing spanning multiple Mealie *groups* (today: one group, `Home`).
- Email-invitation links (the user does not use them; see "Mealie config").
- Proxying Mealie's native **admin** UI through manaaki (fallback, deferred).
- README / PLAN.md doc updates happen during *implementation*, not now.

## Relevant Mealie facts (from source review of `mealie-recipes/mealie`)

These constraints shaped the design; recording them so future readers
understand the "why".

- **OIDC-only login.** This instance has `ALLOW_PASSWORD_LOGIN=false`,
  `OIDC_AUTH_ENABLED=true` (Google). There is no username/password endpoint to
  call — auth is exclusively the Google OIDC flow.
- **Login initiation** `GET /api/auth/oauth` uses Authlib; it stores OAuth
  `state` + PKCE verifier in a Starlette **`session` cookie** and 302-redirects
  to Google.
- **Return address (`redirect_uri`) is global**, path hard-coded to `/login`.
  Computed from `BASE_URL` *if set*; if `BASE_URL` is left at its default,
  Mealie derives it from `request.base_url` (which honors the incoming `Host`
  header + `X-Forwarded-Proto`, since `forwarded_allow_ips="*"`).
- **Callback** `GET /api/auth/oauth/callback` returns the Mealie JWT as **plain
  JSON** (`{access_token, token_type}`) — it does *not* set a cookie or redirect.
  (Mealie's own SPA sets a non-httpOnly cookie client-side afterward.) This is
  what lets our BFF capture the token cleanly.
- **State/PKCE require one origin.** Both initiation and callback must round-trip
  through the same origin so the Starlette `session` cookie is present on the
  callback. Since manaaki proxies `/api/*`, that origin is manaaki's.
- **Token** is an HS256 JWT, default **48h** (`remember_me` → 14d+). Refresh via
  `GET /api/auth/refresh`. No server-side revocation of login tokens
  (stateless-until-expiry); logout just deletes the cookie.
- **Roles** (`admin`, `canManage`, …) come from `GET /api/users/self`, resolved
  per-request — not baked into the token.
- **No production CORS** in Mealie — irrelevant to us because the BFF talks to
  Mealie **server-to-server** over the internal network.
- **Public/anonymous recipe reads** exist but via a different path
  (`/api/explore/...`) gated by privacy flags. We do **not** use those; instead
  the anonymous tier uses a **shared read-only token** (today's model).

## Architecture decision

**B1 — thin BFF with an encrypted, httpOnly cookie, built as a TanStack Start
full-stack app.** Considered and rejected: client-side bearer token (exposes the
token to JS / XSS); a separate BFF sidecar (two deployables for no benefit here);
a server-side session store (extra infra for revocation Mealie barely supports).

For acquiring the per-user token we use **Mechanism 1 — manaaki fronts Mealie's
Google OIDC flow** (rejected alternative: an independent OIDC client that forges
Mealie JWTs with the shared `SECRET`, which couples manaaki to Mealie's internal
signing format).

## Components

### 1. The app shape

manaaki migrates from SPA-only to **TanStack Start full-stack (Nitro server)** —
one build, one container. The server layer is the **BFF**: it serves the SPA and
owns all `/api/*` proxying plus auth. The current `src/api/client.ts` already has
the server/client split (server → `MEALIE_INTERNAL_URL` + injected token;
browser → relative `/api`), so the scaffolding partly exists.

nginx's token-injection job moves into BFF code. Traefik terminates TLS and
routes to the single container. manaaki and Mealie share a Docker network; the
BFF reaches Mealie at `MEALIE_INTERNAL_URL`.

### 2. Three access tiers (enforced server-side)

| Tier | How identified | Token attached by BFF | Allowed |
|------|----------------|------------------------|---------|
| Anonymous | no valid session cookie | **shared browsing token** (env) | recipe **GET** allowlist only |
| Authenticated | valid sealed session cookie | the **user's** Mealie JWT (from cookie) | reads + writes for planner/history/shopping |

Note: Mealie API tokens are **not** intrinsically read-only (they inherit their
user's permissions). The anonymous tier's read-only-ness is enforced by the
**BFF's GET allowlist**, not by the token — exactly as today's nginx config
does. The shared browsing token is just the identity used for public reads.

Authorization is enforced **at the BFF**, not just hidden in the UI: an
authed-only API path called without a session is rejected. The anonymous
allowlist must also permit the OIDC initiation endpoint
(`GET /api/auth/oauth`), since the user is not yet logged in when starting
login.

The **public tier shows the `Home` group's recipes** (confirmed scope) — recipes
are group-scoped in Mealie, so the shared read-only token naturally exposes them.

### 3. Login flow (fronting Mealie OIDC — Mechanism 1 + Host-header refinement)

Config prerequisites:
- Mealie `BASE_URL` is **left at its default** (so Mealie derives `redirect_uri`
  from the request host).
- manaaki's proxy sets upstream **`Host: <manaaki-public-host>`** and
  **`X-Forwarded-Proto: https`** on requests to Mealie.
- The Google OAuth client registers **both** `https://<manaaki-host>/login` and
  `https://<mealie-host>/login` as authorized redirect URIs, so native Mealie
  admin login keeps working independently (the "(ii)" refinement).

Flow:
1. User clicks **Sign in** → browser hits manaaki `GET /api/auth/oauth`
   (transparently proxied to Mealie). Mealie sets the `session` cookie (on
   manaaki's origin) and 302s to Google with `redirect_uri =
   https://<manaaki-host>/login`.
2. User authenticates with Google → browser returns to manaaki
   `/login?code=…&state=…`.
3. manaaki's `/login` hands the `code`/`state` to a **BFF endpoint**, which
   calls Mealie `GET /api/auth/oauth/callback` server-side, **forwarding the
   browser's `session` cookie** (carrying state/PKCE). Mealie returns the JWT as
   **JSON**.
4. The BFF **seals that JWT into manaaki's encrypted httpOnly cookie** and
   redirects the browser into the app. The browser never holds a Mealie token.

Each Google identity resolves to its own Mealie user → correct household. New
households/users are managed in Mealie as today; nothing manaaki-side to add.

### 4. Session lifecycle

- **Cookie:** name e.g. `manaaki_session`; **encrypted** (authenticated
  encryption, e.g. AES-GCM via a sealed-cookie library) + **httpOnly** +
  **secure** + **`sameSite=lax`**. Payload: the Mealie JWT and its expiry.
- **Refresh:** before expiry the BFF calls Mealie `GET /api/auth/refresh`
  server-side with the current token and re-seals the cookie. `remember_me` used
  for longer sessions.
- **Logout:** BFF clears `manaaki_session` (and best-effort Mealie logout). Since
  Mealie can't revoke login JWTs, clearing the cookie is the effective logout.

### 5. BFF endpoints (server routes)

- `GET /api/auth/oauth` — transparent proxy to Mealie (initiation).
- BFF login-completion route (consumes `code`/`state`, calls Mealie callback,
  seals cookie, redirects). Lives under a manaaki-owned namespace to avoid
  colliding with Mealie's `/api/auth/*`.
- `POST` logout — clears the session cookie.
- "Who am I" loader — returns the current user (`GET /api/users/self` via the
  session token) or `null`. Drives UI gating.
- Catch-all `/api/*` proxy — attaches the correct token per tier (§2), enforces
  the anonymous GET allowlist, forwards `Host`/`X-Forwarded-Proto`.

### 6. Frontend gating

- Nav renders authed features (**Planner**, **History**, **Shopping**) only when
  the "who am I" loader returns a user; otherwise a **Sign in** affordance.
- Route guards on `/plan` (and future `/history`, `/shopping`) redirect anonymous
  users to sign in. This is **UX only** — real enforcement is server-side (§2).
- `/plan` gets surfaced in nav (for authed users) — it exists already and is
  navigation-only; no feature expansion here.

## Configuration / deployment (Dokploy)

Single container behind Traefik. Environment:

| Variable | Purpose |
|----------|---------|
| `MEALIE_INTERNAL_URL` | server-to-server base URL for Mealie (existing) |
| `MEALIE_READONLY_TOKEN` | shared read-only token for the anonymous tier |
| `SESSION_SECRET` (manaaki) | key for sealing the encrypted session cookie |
| Google/OIDC | handled by Mealie; manaaki only needs the redirect URIs registered |

Mealie-side: `BASE_URL` left default; Google OAuth client gains both `/login`
redirect URIs. manaaki's proxy sets `Host` + `X-Forwarded-Proto` upstream.

## Security considerations

- Per-user token lives only in an encrypted httpOnly cookie → unreadable by JS,
  so the recipe-content XSS surface can't exfiltrate it.
- Anonymous tier remains GET-allowlist-restricted; writes require a session.
- BFF↔Mealie is server-to-server on the internal network; secrets
  (`MEALIE_READONLY_TOKEN`, `SESSION_SECRET`) never reach the browser.
- Authorization enforced server-side, not merely via hidden UI.

## Testing approach

- BFF tier logic: anonymous request gets read-only token + allowlist; authed
  request gets the session token; authed-only path without a session is rejected.
- Login completion: given a Mealie callback JSON response, the BFF seals a valid
  session cookie and never returns the raw token to the browser.
- Session refresh + logout behavior.
- Frontend: nav + route guards render correctly for authed vs anonymous "who am
  I" states.

## Open questions / follow-ups

- If `BASE_URL`-default ever breaks something relied upon (not email invites —
  unused), fall back to proxying Mealie's native admin UI through manaaki with
  injected token. Deferred.
- Multi-*group* public browsing, per-feature roles, meal history, shopping list
  builder — each a later spec.
