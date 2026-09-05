# Silent re-login for known devices — design

Date: 2026-09-05

## Problem

A Mealie session lapses after `TOKEN_TIME` without activity. The user then
lands in the anonymous tier and has to press "Sign in with Google" again, even
though their browser still holds a live Google session. First-time visitors,
and people who deliberately signed out, must *not* be bounced through Google.

## Mechanism

OpenID Connect `prompt=none`: Google either returns an authorization code with
no UI (live Google session, consent already granted) or redirects straight
back with `error=login_required` / `interaction_required` /
`account_selection_required`. Mealie is not involved until manaaki has a code;
its stateless native token endpoint cannot tell a silent code from an
interactive one. No Mealie change or setting is needed.

## Cookies (all sealed or opaque, HttpOnly, SameSite=Lax, `__Host-` when https)

| Cookie | Set when | Cleared when | Lifetime | Payload |
|---|---|---|---|---|
| `manaaki_known` | login completes | explicit sign-out | 365 days | `{ e: email }` (sealed) |
| `manaaki_silent` | a silent attempt starts | expiry | 10 min | `1` (loop guard) |
| `manaaki_oidc` | login starts | login completes | 10 min | state, nonce, verifier, redirectUri, **returnTo, silent** |

## Flow

1. **Trigger (request middleware, `src/start.ts`).** On a page request
   (`handlerType === "router"`, `GET`, `Accept` includes `text/html`, path not
   under `/api/`, not `/login`, no file extension): if there is **no session
   cookie**, a **known-device cookie**, and **no recent silent marker**, respond
   `302 /api/auth/oauth?silent=1&returnTo=<path+query>`.
2. **Start (`/api/auth/oauth`).** `silent=1` adds `prompt=none` and
   `login_hint=<email from known cookie>` to the Google request and sets the
   silent marker. `returnTo` (validated: begins with a single `/`) is stored in
   the attempt cookie; default `/recipes`. Interactive logins may pass
   `returnTo` too (route guards use it).
3. **Return (`/login`).** Google returns `code&state` on success or
   `error&state` on refusal; both are forwarded to `/api/auth/complete`.
4. **Complete (`/api/auth/complete`).** Always clears the attempt cookie.
   - `error` present, attempt silent → `302 returnTo`, still anonymous.
   - `error` present, interactive → `302 /login?error=oauth`.
   - success → seal session, look up `/api/users/self` for the email, set the
     known-device cookie, `302 returnTo`.
   - exchange failure → silent: `302 returnTo`; interactive: `/login?error=oauth`.
5. **Sign-out** clears the session **and** the known-device cookie, so the
   next page load stays anonymous.

## Non-goals

- Hidden-iframe silent auth (Google forbids framing its authorization endpoint).
- One Tap / FedCM (they yield ID tokens; Mealie only accepts a code).
- Surfacing `/login?error=oauth` in the UI (existing follow-up, unchanged).
