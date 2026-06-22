# Auth foundation + public/private split — design

Date: 2026-06-22
Revised: 2026-06-22 (incorporating external review)

## Problem

manaaki is currently a single-tier app: every visitor acts as the *same* Mealie
user via one shared API token. Today that token is injected by nginx for a
GET-only allowlist of browser `/api` calls, and by the SSR server for
server-side data fetches. There is no concept of "who is using the app." This
blocks the product direction:

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

## Current architecture (verified)

The app is **already a TanStack Start full-stack app**, not an SPA. The container
(`Dockerfile`, `docker-entrypoint.sh`) runs **two processes**:

1. **node SSR server** (`server.js` → `srvx` serving `dist/server/server.js`) on
   `127.0.0.1:3000`.
2. **nginx** on `:80`, which: serves static assets from `dist/client`; proxies
   PostHog `/ingest*`; proxies a **GET-only Mealie allowlist**
   (`/api/recipes`, `/api/households/mealplans`, `=/api/users/self`,
   `/api/media/recipes/`) to Mealie with the token injected via
   `mealie-proxy-headers.conf`; returns **403 for any other `/api/*`**; and
   forwards everything else to the SSR server (`@ssr`).

So the Mealie token is used in **two** places today: nginx (browser `/api`
calls) and `src/api/client.ts` (SSR data fetches via the global SDK client).
Traefik (Dokploy) terminates TLS in front of the container.

**The real migration** is therefore *not* "SPA → full-stack" — it is **moving
Mealie API proxying out of nginx and into the node BFF**, and making token
handling per-user.

## Goals

- Introduce a real auth boundary: **anonymous** vs **authenticated** access.
- Authentication is delegated entirely to **Mealie via Google OIDC** (Mealie is
  the identity provider). manaaki never stores passwords or implements auth
  logic of its own.
- A logged-in user's Mealie token is **never exposed to browser JavaScript**
  (kept in an encrypted httpOnly cookie) — preventing token *theft* via XSS.
- Per-user data scoping "just works" — each Google identity resolves to its own
  Mealie user, hence the correct household.
- Deployable as the same single container on Dokploy behind Traefik.

## Non-goals (deferred)

- Meal history feature (own spec).
- Shopping list builder feature (own spec).
- Per-feature role gating beyond authenticated/anonymous (Mealie's `canManage`
  etc. ride along via `/api/users/self` and can be used later).
- Public browsing spanning multiple Mealie *groups* (today: one group, `Home`).
- Email-invitation links (the user does not use them).
- Proxying Mealie's native **admin** UI through manaaki (fallback, deferred).
- Recipe-content output sanitization — a pre-existing rendering concern, related
  but separate from auth (see Security). Verify usage before any action.
- README / PLAN.md doc updates happen during *implementation*, not now.

## Relevant Mealie facts (from source review of `mealie-recipes/mealie`)

- **OIDC-only login.** `ALLOW_PASSWORD_LOGIN=false`, `OIDC_AUTH_ENABLED=true`
  (Google). No username/password endpoint to call.
- **Login initiation** `GET /api/auth/oauth` uses Authlib; stores OAuth `state`
  + PKCE verifier in a Starlette **`session` cookie** (default name `session`)
  and 302-redirects to Google.
- **Return address (`redirect_uri`) is global**, path hard-coded to `/login`.
  Computed from `BASE_URL` *if set*; if `BASE_URL` is left at its default,
  Mealie derives it from `request.base_url` (honors incoming `Host` +
  `X-Forwarded-Proto`, since `forwarded_allow_ips="*"`).
- **Callback** `GET /api/auth/oauth/callback` returns the JWT as **plain JSON**
  (`{access_token, token_type}`) — no cookie, no redirect. This lets the BFF
  capture the token cleanly.
- **State/PKCE require one origin.** Both initiation and callback must round-trip
  through the same origin carrying the `session` cookie. That origin is
  manaaki's.
- **Token** is an HS256 JWT, default **48h**. Refresh via `GET /api/auth/refresh`
  (needs a still-valid token). No server-side revocation of login tokens
  (stateless-until-expiry); logout just deletes the cookie. **`remember_me` is a
  field of the password-login form, NOT part of the OIDC flow** — session length
  for OIDC is governed by Mealie's `TOKEN_TIME` and `OIDC_REMEMBER_ME` settings.
- **Roles** (`admin`, `canManage`, …) come from `GET /api/users/self`.
- **No production CORS** — irrelevant; the BFF talks to Mealie
  **server-to-server**.

## Architecture decision

**B1 — thin BFF with an encrypted, httpOnly cookie, hosted by the existing
TanStack Start node server.** The BFF takes over all `/api/*` handling. For
acquiring the per-user token we use **Mechanism 1 — manaaki fronts Mealie's
Google OIDC flow** (rejected alternative: an independent OIDC client that forges
Mealie JWTs with the shared `SECRET`, which couples manaaki to Mealie internals).

## Components

### 1. Routing model (Option A — BFF owns `/api/*`)

nginx stops proxying Mealie. It forwards **all `/api/*` to the node SSR/BFF
server** (`@ssr`), keeps serving static assets + PostHog `/ingest*`, and keeps
the SPA fallback. Consequently:

- Remove the per-endpoint Mealie `location` blocks and the `return 403`
  catch-all from `nginx.conf.template`.
- Remove `MEALIE_API_TOKEN` and `mealie-proxy-headers.conf` from
  `nginx.conf.template`, `Dockerfile`, and `docker-entrypoint.sh`.
- The BFF becomes the single place that holds Mealie tokens and enforces tiers.

### 2. Per-request API client (no global token)

`src/api/client.ts` currently calls `client.setConfig({...Authorization...})`
once per process — safe only because there is a single shared token. With
per-user tokens this races across concurrent SSR requests (last-writer-wins →
cross-user data leak).

- The **global** client keeps **no** `Authorization` header (browser uses it for
  relative `/api`, where the BFF attaches the token).
- Server-side calls that need a specific identity build a **per-request** client:
  `createClient(createConfig({ baseUrl: MEALIE_INTERNAL_URL, headers: {
  Authorization: 'Bearer ' + token } }))` and pass it via the SDK `client`
  option. (`createClient`/`createConfig` are exported by the generated client.)
- `getCurrentUser` (`src/api/auth.ts`) is replaced by the "who am I" server
  function (§5); `useGroupSlug` and any mocking tests are updated.

### 3. Three access tiers (enforced at the BFF)

| Tier | Identified by | Token attached | Authorization |
|------|---------------|----------------|----------------|
| Anonymous | no/invalid session cookie | **shared browsing token** (env) | **strict GET allowlist** (recipes, users/self, media) + `GET /api/auth/oauth` — **no** meal plans (those are authed-only, since `/plan` is gated) |
| Authenticated | valid sealed session cookie | the **user's** Mealie JWT | **pass-through** — Mealie enforces per-user authz |

Rationale for the asymmetry: the anonymous tier rides the *shared* token (broad
permissions), so its allowlist is **security-critical** and stays GET-only —
this preserves today's nginx safety property. An authenticated user *is* their
real Mealie identity and can do nothing through manaaki they couldn't do logged
into Mealie directly, so a manaaki-side allowlist for authed traffic adds
maintenance for no security gain; the BFF forwards with their token and lets
Mealie authorize. (Anonymous reads expose the **`Home` group's** recipes —
recipes are group-scoped.)

### 4. The proxy passthrough (raw, not the SDK)

The catch-all `/api/*` handler builds a fresh `Request` to Mealie and returns
Mealie's `Response` directly (it does **not** route through the typed SDK
client). It must:

- **Strip** any client-supplied `Authorization` header; set the correct token
  (shared or user) itself.
- Set upstream **`Host`** to manaaki's public host and **`X-Forwarded-Proto:
  https`** (needed for Mealie's OIDC `redirect_uri` derivation).
- Forward the Mealie **`session`** cookie where required (OIDC), and **never**
  forward manaaki's session cookie to Mealie.
- Stream request/response bodies; not cache authed responses as public.

### 5. Login flow (fronting Mealie OIDC — Mechanism 1 + Host-header refinement)

Config prerequisites:
- Mealie `BASE_URL` **left at default** (so `redirect_uri` follows the request
  host).
- The proxy sets upstream `Host: <manaaki-host>` + `X-Forwarded-Proto: https`.
- Google OAuth client registers **both** `https://<manaaki-host>/login` and
  `https://<mealie-host>/login` so native Mealie admin login keeps working.

Flow:
1. **Sign in** → browser hits manaaki `GET /api/auth/oauth` (proxied to Mealie).
   Mealie sets the `session` cookie (manaaki's origin) and 302s to Google with
   `redirect_uri = https://<manaaki-host>/login`.
2. Google → browser returns to manaaki **`/login?code=…&state=…`**.
3. The **`/login` route loader** runs server-side: reads the Mealie `session`
   cookie from the request, calls Mealie `GET /api/auth/oauth/callback`
   forwarding that cookie, and receives the JWT as **JSON**. On success it
   **seals the JWT into the manaaki cookie** and `throw redirect(...)` to the
   post-login target. With no `code`/`state`, it renders the sign-in page. (The
   existing "Unable to connect" content moves elsewhere or becomes a distinct
   error state.)

Each Google identity resolves to its own Mealie user → correct household.

### 6. Session cookie & lifecycle

- **Cookie:** `__Host-manaaki_session` in production (implies `Secure`, no
  `Domain`, `Path=/`); **httpOnly**; `sameSite=lax`. Dev caveat: `__Host-` /
  `Secure` is awkward over plain http, so dev may use a non-prefixed name.
  Payload: the Mealie JWT **and its expiry**, sealed with authenticated
  encryption (e.g. AES-GCM via a sealed-cookie helper) keyed by `SESSION_SECRET`.
- **Refresh policy (explicit):** on each authed request, if the token is within a
  threshold of expiry (e.g. < ~25% of lifetime / < 1h remaining), the BFF calls
  Mealie `GET /api/auth/refresh` and re-seals the cookie. If the token is
  expired: treat the request as **anonymous** for public paths, return **401**
  for authed-only paths. Overall session length is tuned via Mealie's
  `TOKEN_TIME` / `OIDC_REMEMBER_ME` — not a per-login flag manaaki sends.
- **Logout:** `POST` clears `__Host-manaaki_session` (CSRF-safe shape);
  best-effort Mealie logout. Clearing the cookie is the effective logout.

### 7. "Who am I" + frontend gating

- A **"who am I" server function** returns a lightweight user for **both** tiers:
  for authed, from the session token; for anonymous, from `/api/users/self` via
  the shared browsing token — including **`groupSlug`** (so public "View in
  Mealie" links keep working) and an **`isAnonymous`** flag.
- Nav shows authed features (**Planner**, **History**, **Shopping**) and a
  profile/logout only when `!isAnonymous`; otherwise a **Sign in** affordance.
- Route guards on `/plan` (and future `/history`, `/shopping`) redirect anonymous
  users to sign in. **UX only** — real enforcement is the BFF (§3). Post-login
  redirect preserves the originally requested target (default `/recipes`).
- `/plan` is surfaced in nav for authed users; no feature expansion here.

## Configuration / deployment (Dokploy)

Same single container; nginx + node as today, but nginx no longer touches Mealie.

| Variable | Purpose |
|----------|---------|
| `MEALIE_INTERNAL_URL` | server-to-server base URL for Mealie (existing) |
| `MEALIE_READONLY_TOKEN` | shared browsing token for the anonymous tier |
| `SESSION_SECRET` | key for sealing the encrypted manaaki session cookie |

- **Dev:** remove the `/api` proxy from `vite.config.ts` so `/api/*` hits the
  BFF; ensure the dev server can read `MEALIE_INTERNAL_URL`,
  `MEALIE_READONLY_TOKEN`, `SESSION_SECRET` from `.env` at runtime (Vite does not
  auto-load `.env` into `process.env` for server code).
- **Mealie-side:** `BASE_URL` left default; Google OAuth client gains both
  `/login` redirect URIs.

## Security considerations

- Per-user token lives only in an encrypted httpOnly cookie → unreadable by JS,
  so XSS cannot **exfiltrate** it. (It does not by itself prevent action-forgery
  via the user's own cookies — that is true of any cookie session; output
  sanitization of recipe content is the complementary defense and is tracked
  separately.)
- Anonymous tier is GET-allowlist-restricted on the *shared* token; all writes
  require an authenticated session.
- BFF↔Mealie is server-to-server on the internal network; `MEALIE_READONLY_TOKEN`
  and `SESSION_SECRET` never reach the browser.
- Authorization enforced server-side, not merely via hidden UI.

## Testing approach

- BFF tiers: anonymous request → read-only token + allowlist enforced (non-GET /
  off-list → blocked); authed request → user token pass-through; authed-only path
  without a session → 401.
- Concurrency: two simultaneous authed requests with different tokens do not bleed
  (validates the per-request client, §2).
- Login completion: given a Mealie callback JSON response, the `/login` loader
  seals a valid session cookie and never returns the raw token to the browser.
- Refresh near-expiry; expired-token handling (anonymous vs 401); logout.
- Frontend: nav + route guards for authed vs anonymous `isAnonymous` states;
  public "View in Mealie" link still resolves a `groupSlug`.

## Open questions — resolved

1. **Routing model** → Option A: nginx forwards all `/api/*` to the BFF.
2. **Cookie prefix** → `__Host-manaaki_session` in prod (dev caveat noted).
3. **Post-login redirect** → preserve the requested target; default `/recipes`.
4. **Refresh threshold** → refresh when < ~25% lifetime / < 1h remains.
5. **Authed allowlist** → none; pass-through with the user token, Mealie
   authorizes (only the anonymous tier is allowlisted).
6. **Dev env loading** → ensure the dev server reads `.env` into `process.env`
   for server code.
7. **Admin UI fallback** → deferred; only if `BASE_URL`-default breaks a
   relied-upon Mealie feature.

## Follow-ups

- Post-deploy: verify no relied-upon Mealie feature (notifications, share links)
  breaks due to `BASE_URL` being unset.
- Later specs: meal history, shopping list builder, multi-group public browsing,
  per-feature role gating.
