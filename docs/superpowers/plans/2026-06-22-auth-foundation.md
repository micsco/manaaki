# Auth Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a BFF auth boundary so anyone can browse recipes while logged-in members (per-user Mealie identity via Google OIDC) get household-scoped planner/history/shopping — with the user's Mealie token held only in an encrypted httpOnly cookie.

**Architecture:** The existing TanStack Start node server becomes a BFF. nginx forwards all `/api/*` to it. The BFF detects tier from a sealed cookie, attaches the right Mealie token (constant read-only token for anonymous with a strict GET allowlist; the user's token pass-through for authed), and fronts Mealie's Google OIDC flow — capturing the JWT (returned as JSON by Mealie's callback) and sealing it. The global SDK client only ever holds the constant read-only token server-side; per-user tokens never touch it.

**Tech Stack:** TanStack Start `@tanstack/react-start@1.168` (server routes via `createFileRoute({ server: { handlers } })`), `@hey-api` generated client (`createClient`/`createConfig`), Node built-in `node:crypto` (AES-256-GCM, no new deps), vitest + jsdom + @testing-library/react.

## Global Constraints

- **No new runtime dependencies.** Use `node:crypto` for sealing and manual cookie parsing. (Spec: keep deps lean.)
- **Per-user Mealie tokens must never reach browser JS** — only an encrypted httpOnly cookie. (Spec: Security.)
- **The global SDK client (`src/api/client.ts`) must never hold a per-user token** — server-side it holds the constant `MEALIE_READONLY_TOKEN`; in the browser it holds no token. Per-user calls go through the BFF. (Spec §2.)
- **Anonymous tier = strict GET allowlist** on the shared token: `/api/recipes/**`, `=/api/users/self`, `/api/media/recipes/**`, plus `GET /api/auth/oauth` (login init). **No meal plans for anonymous.** Authed tier = pass-through (Mealie authorizes). (Spec §3.)
- **Mealie `BASE_URL` stays at its default**; the BFF sets upstream `Host: <public host>` and `X-Forwarded-Proto: https`. (Spec §5.)
- **manaaki session cookie** is `__Host-manaaki_session` in production (Secure, no Domain, Path=/); a non-prefixed name `manaaki_session` is used when not on https (dev). Never forward it to Mealie. Forward Mealie's `session` cookie only during OIDC. (Spec §4/§6.)
- Path alias `~` → `/src` (vitest only; source uses relative imports). Tests live beside source as `*.test.ts(x)`, jsdom env, `render` from `src/test/render`.
- Env var names: `MEALIE_INTERNAL_URL`, `MEALIE_READONLY_TOKEN`, `SESSION_SECRET`.

---

## File Structure

**New (server BFF — plain TS, unit-testable without the framework):**
- `src/server/env.ts` — typed accessors for `MEALIE_INTERNAL_URL`, `MEALIE_READONLY_TOKEN`, `SESSION_SECRET` (throw if missing).
- `src/server/cookies.ts` — `parseCookie(header, name)`, `serializeCookie(name, value, opts)`.
- `src/server/session.ts` — `sealSession`, `unsealSession`, `decodeJwtExp`, cookie name + flags, `readSessionToken(request)`, `sessionSetCookie(token)`, `clearSessionCookie()`.
- `src/server/allowlist.ts` — `isAnonymousAllowed(method, pathname)`.
- `src/server/mealieClient.ts` — `createMealieClient(token)` per-request typed client.
- `src/server/proxy.ts` — `handleApiProxy(request)`: tier detection, allowlist, header hygiene, refresh, passthrough.
- `src/server/oauth.ts` — `completeOidc(request)`: call Mealie callback with forwarded `session` cookie, return `{ token }` or throw.

**New (framework server routes — thin wrappers over the above):**
- `src/routes/api.$.ts` — splat → `handleApiProxy`.
- `src/routes/api.auth.complete.ts` — OIDC completion → seal cookie, 302 to target.
- `src/routes/api.auth.me.ts` — who-am-i JSON.
- `src/routes/api.auth.logout.ts` — POST clears cookie.

**New (frontend):**
- `src/hooks/useCurrentUser.ts` — React Query over `/api/auth/me`.
- `src/components/UserMenu.tsx` — Sign in / account (Planner link + Logout).

**Modified:**
- `src/api/client.ts` — global client: server uses `MEALIE_READONLY_TOKEN`; browser no token.
- `src/api/auth.ts` — replace `getCurrentUser` (global-token) with a `/api/auth/me` fetch.
- `src/hooks/useGroupSlug.ts` — derive from `useCurrentUser`.
- `src/routes/login.tsx` — `validateSearch` + `beforeLoad` redirect to `/api/auth/complete`; else sign-in page.
- `src/routes/plan.tsx` — `beforeLoad` auth guard; drop SSR prefetch (client-fetch).
- `src/routes/recipes.index.tsx` — render `<UserMenu/>` in the header.
- `nginx.conf.template`, `Dockerfile`, `docker-entrypoint.sh` — forward `/api/*` to `@ssr`; drop Mealie locations + token.
- `vite.config.ts` — remove `/api` dev proxy; populate `process.env` from `.env` for dev server code.
- `.env.example` — new vars.

**Routing note:** TanStack Router gives explicit segments precedence over the `$` splat, so `api.auth.me.ts` / `api.auth.complete.ts` / `api.auth.logout.ts` win over `api.$.ts`. After creating routes, confirm `src/routeTree.gen.ts` regenerated (it regenerates on `pnpm dev`/`build`).

---

## Task 1: Server env accessors

**Files:**
- Create: `src/server/env.ts`
- Test: `src/server/env.test.ts`

**Interfaces:**
- Produces: `mealieInternalUrl(): string`, `readonlyToken(): string`, `sessionSecret(): string` (each throws if the env var is unset/empty).

- [ ] **Step 1: Write the failing test**

```ts
// src/server/env.test.ts
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { mealieInternalUrl, readonlyToken, sessionSecret } from "./env"

const KEYS = ["MEALIE_INTERNAL_URL", "MEALIE_READONLY_TOKEN", "SESSION_SECRET"] as const
let saved: Record<string, string | undefined>

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map(k => [k, process.env[k]]))
})
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

describe("server env", () => {
  it("returns the configured values", () => {
    process.env.MEALIE_INTERNAL_URL = "http://mealie:9000"
    process.env.MEALIE_READONLY_TOKEN = "ro-token"
    process.env.SESSION_SECRET = "secret"
    expect(mealieInternalUrl()).toBe("http://mealie:9000")
    expect(readonlyToken()).toBe("ro-token")
    expect(sessionSecret()).toBe("secret")
  })

  it("throws when a required var is missing", () => {
    process.env.SESSION_SECRET = ""
    expect(() => sessionSecret()).toThrow(/SESSION_SECRET/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/server/env.test.ts`
Expected: FAIL — cannot find module `./env`.

- [ ] **Step 3: Write the implementation**

```ts
// src/server/env.ts
function required(name: string): string {
  const value = globalThis.process?.env?.[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export const mealieInternalUrl = (): string => required("MEALIE_INTERNAL_URL")
export const readonlyToken = (): string => required("MEALIE_READONLY_TOKEN")
export const sessionSecret = (): string => required("SESSION_SECRET")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/server/env.test.ts`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add src/server/env.ts src/server/env.test.ts
git commit -m "feat(server): typed required-env accessors for BFF"
```

---

## Task 2: Cookie parse/serialize helpers

**Files:**
- Create: `src/server/cookies.ts`
- Test: `src/server/cookies.test.ts`

**Interfaces:**
- Produces:
  - `parseCookie(header: string | null, name: string): string | undefined`
  - `serializeCookie(name: string, value: string, opts?: { maxAge?: number; httpOnly?: boolean; secure?: boolean; sameSite?: "lax" | "strict" | "none"; path?: string }): string`

- [ ] **Step 1: Write the failing test**

```ts
// src/server/cookies.test.ts
import { describe, expect, it } from "vitest"
import { parseCookie, serializeCookie } from "./cookies"

describe("parseCookie", () => {
  it("finds a named cookie among several", () => {
    expect(parseCookie("a=1; manaaki_session=xyz; b=2", "manaaki_session")).toBe("xyz")
  })
  it("URL-decodes the value", () => {
    expect(parseCookie("t=a%20b", "t")).toBe("a b")
  })
  it("returns undefined when absent or header is null", () => {
    expect(parseCookie("a=1", "missing")).toBeUndefined()
    expect(parseCookie(null, "t")).toBeUndefined()
  })
})

describe("serializeCookie", () => {
  it("serializes name, value and flags", () => {
    const out = serializeCookie("t", "v", {
      maxAge: 60,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    })
    expect(out).toContain("t=v")
    expect(out).toContain("Max-Age=60")
    expect(out).toContain("HttpOnly")
    expect(out).toContain("Secure")
    expect(out).toContain("SameSite=Lax")
    expect(out).toContain("Path=/")
  })
  it("URL-encodes the value", () => {
    expect(serializeCookie("t", "a b")).toContain("t=a%20b")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/server/cookies.test.ts`
Expected: FAIL — cannot find module `./cookies`.

- [ ] **Step 3: Write the implementation**

```ts
// src/server/cookies.ts
export function parseCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined
  for (const part of header.split(";")) {
    const eq = part.indexOf("=")
    if (eq === -1) continue
    const key = part.slice(0, eq).trim()
    if (key === name) {
      return decodeURIComponent(part.slice(eq + 1).trim())
    }
  }
  return undefined
}

export function serializeCookie(
  name: string,
  value: string,
  opts: {
    maxAge?: number
    httpOnly?: boolean
    secure?: boolean
    sameSite?: "lax" | "strict" | "none"
    path?: string
  } = {}
): string {
  const segments = [`${name}=${encodeURIComponent(value)}`]
  if (opts.path) segments.push(`Path=${opts.path}`)
  if (opts.maxAge !== undefined) segments.push(`Max-Age=${Math.floor(opts.maxAge)}`)
  if (opts.httpOnly) segments.push("HttpOnly")
  if (opts.secure) segments.push("Secure")
  if (opts.sameSite) {
    const v = opts.sameSite[0].toUpperCase() + opts.sameSite.slice(1)
    segments.push(`SameSite=${v}`)
  }
  return segments.join("; ")
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/server/cookies.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/cookies.ts src/server/cookies.test.ts
git commit -m "feat(server): cookie parse/serialize helpers"
```

---

## Task 3: Session sealing + cookie integration

**Files:**
- Create: `src/server/session.ts`
- Test: `src/server/session.test.ts`

**Interfaces:**
- Consumes: `sessionSecret()` (Task 1); `parseCookie`/`serializeCookie` (Task 2).
- Produces:
  - `sealSession(token: string): string` — AES-256-GCM seal of `{ t: token }`.
  - `unsealSession(sealed: string): string | null` — returns the token or `null` if tampered/invalid.
  - `decodeJwtExp(token: string): number | null` — `exp` (epoch seconds) from the JWT payload, no signature check.
  - `SESSION_COOKIE_NAME(secure: boolean): string` — `__Host-manaaki_session` if secure else `manaaki_session`.
  - `readSessionToken(request: Request): string | null` — read + unseal the manaaki cookie from a request.
  - `buildSessionSetCookie(token: string, secure: boolean): string` — `Set-Cookie` value sealing the token.
  - `buildClearSessionCookie(secure: boolean): string` — `Set-Cookie` that expires the cookie.
  - `isSecureRequest(request: Request): boolean` — true when `X-Forwarded-Proto` is `https`.

- [ ] **Step 1: Write the failing test**

```ts
// src/server/session.test.ts
import { beforeEach, describe, expect, it } from "vitest"
import {
  buildClearSessionCookie,
  buildSessionSetCookie,
  decodeJwtExp,
  isSecureRequest,
  readSessionToken,
  sealSession,
  SESSION_COOKIE_NAME,
  unsealSession,
} from "./session"

beforeEach(() => {
  process.env.SESSION_SECRET = "unit-test-secret"
})

// Minimal unsigned JWT with exp claim for decode tests.
function fakeJwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url")
  return `${b64({ alg: "HS256" })}.${b64(payload)}.sig`
}

describe("seal/unseal", () => {
  it("round-trips a token", () => {
    const sealed = sealSession("my-jwt")
    expect(sealed).not.toContain("my-jwt")
    expect(unsealSession(sealed)).toBe("my-jwt")
  })
  it("returns null on tampering", () => {
    const sealed = sealSession("my-jwt")
    const tampered = `${sealed.slice(0, -2)}xx`
    expect(unsealSession(tampered)).toBeNull()
  })
  it("returns null on garbage", () => {
    expect(unsealSession("not-base64!!")).toBeNull()
  })
})

describe("decodeJwtExp", () => {
  it("reads the exp claim", () => {
    expect(decodeJwtExp(fakeJwt({ exp: 1893456000 }))).toBe(1893456000)
  })
  it("returns null when malformed", () => {
    expect(decodeJwtExp("nope")).toBeNull()
  })
})

describe("cookie name + flags", () => {
  it("uses __Host- prefix only when secure", () => {
    expect(SESSION_COOKIE_NAME(true)).toBe("__Host-manaaki_session")
    expect(SESSION_COOKIE_NAME(false)).toBe("manaaki_session")
  })
  it("isSecureRequest reads X-Forwarded-Proto", () => {
    expect(isSecureRequest(new Request("http://x/", { headers: { "x-forwarded-proto": "https" } }))).toBe(true)
    expect(isSecureRequest(new Request("http://x/"))).toBe(false)
  })
})

describe("request/response integration", () => {
  it("reads back a token sealed into a Set-Cookie", () => {
    const setCookie = buildSessionSetCookie("jwt-123", false)
    const value = setCookie.split(";")[0].split("=").slice(1).join("=")
    const request = new Request("http://x/", { headers: { cookie: `manaaki_session=${value}` } })
    expect(readSessionToken(request)).toBe("jwt-123")
  })
  it("clear cookie has Max-Age=0", () => {
    expect(buildClearSessionCookie(false)).toContain("Max-Age=0")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/server/session.test.ts`
Expected: FAIL — cannot find module `./session`.

- [ ] **Step 3: Write the implementation**

```ts
// src/server/session.ts
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"
import { parseCookie, serializeCookie } from "./cookies"
import { sessionSecret } from "./env"

const ALGO = "aes-256-gcm"
const IV_LEN = 12
const TAG_LEN = 16
// Default cookie lifetime cap (seconds); Mealie's own JWT exp governs real validity.
const MAX_AGE = 60 * 60 * 24 * 14

function key(): Buffer {
  // Derive a fixed 32-byte key from any-length secret.
  return createHash("sha256").update(sessionSecret()).digest()
}

export function sealSession(token: string): string {
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGO, key(), iv)
  const enc = Buffer.concat([cipher.update(JSON.stringify({ t: token }), "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString("base64url")
}

export function unsealSession(sealed: string): string | null {
  try {
    const raw = Buffer.from(sealed, "base64url")
    if (raw.length < IV_LEN + TAG_LEN) return null
    const iv = raw.subarray(0, IV_LEN)
    const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN)
    const enc = raw.subarray(IV_LEN + TAG_LEN)
    const decipher = createDecipheriv(ALGO, key(), iv)
    decipher.setAuthTag(tag)
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8")
    const parsed = JSON.parse(dec) as { t?: unknown }
    return typeof parsed.t === "string" ? parsed.t : null
  } catch {
    return null
  }
}

export function decodeJwtExp(token: string): number | null {
  try {
    const payload = token.split(".")[1]
    if (!payload) return null
    const json = Buffer.from(payload, "base64url").toString("utf8")
    const claims = JSON.parse(json) as { exp?: unknown }
    return typeof claims.exp === "number" ? claims.exp : null
  } catch {
    return null
  }
}

export function isSecureRequest(request: Request): boolean {
  return request.headers.get("x-forwarded-proto") === "https"
}

export function SESSION_COOKIE_NAME(secure: boolean): string {
  return secure ? "__Host-manaaki_session" : "manaaki_session"
}

export function readSessionToken(request: Request): string | null {
  const secure = isSecureRequest(request)
  const sealed = parseCookie(request.headers.get("cookie"), SESSION_COOKIE_NAME(secure))
  return sealed ? unsealSession(sealed) : null
}

export function buildSessionSetCookie(token: string, secure: boolean): string {
  return serializeCookie(SESSION_COOKIE_NAME(secure), sealSession(token), {
    maxAge: MAX_AGE,
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
  })
}

export function buildClearSessionCookie(secure: boolean): string {
  return serializeCookie(SESSION_COOKIE_NAME(secure), "", {
    maxAge: 0,
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/server/session.test.ts`
Expected: PASS (all groups).

- [ ] **Step 5: Commit**

```bash
git add src/server/session.ts src/server/session.test.ts
git commit -m "feat(server): encrypted session sealing + cookie integration"
```

---

## Task 4: Anonymous allowlist

**Files:**
- Create: `src/server/allowlist.ts`
- Test: `src/server/allowlist.test.ts`

**Interfaces:**
- Produces: `isAnonymousAllowed(method: string, pathname: string): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
// src/server/allowlist.test.ts
import { describe, expect, it } from "vitest"
import { isAnonymousAllowed } from "./allowlist"

describe("isAnonymousAllowed", () => {
  it("allows GET recipes, users/self, media, oauth init", () => {
    expect(isAnonymousAllowed("GET", "/api/recipes")).toBe(true)
    expect(isAnonymousAllowed("GET", "/api/recipes/abc")).toBe(true)
    expect(isAnonymousAllowed("GET", "/api/users/self")).toBe(true)
    expect(isAnonymousAllowed("GET", "/api/media/recipes/x.png")).toBe(true)
    expect(isAnonymousAllowed("GET", "/api/auth/oauth")).toBe(true)
  })
  it("denies meal plans for anonymous", () => {
    expect(isAnonymousAllowed("GET", "/api/households/mealplans")).toBe(false)
  })
  it("denies non-GET even on allowed paths", () => {
    expect(isAnonymousAllowed("POST", "/api/recipes")).toBe(false)
    expect(isAnonymousAllowed("DELETE", "/api/recipes/abc")).toBe(false)
  })
  it("denies unlisted paths", () => {
    expect(isAnonymousAllowed("GET", "/api/admin/users")).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/server/allowlist.test.ts`
Expected: FAIL — cannot find module `./allowlist`.

- [ ] **Step 3: Write the implementation**

```ts
// src/server/allowlist.ts
// Anonymous users ride the shared read-only token, so this is security-critical:
// GET-only, recipe-browsing surface plus the OIDC login initiation. No meal plans.
const ALLOWED_GET_PREFIXES = ["/api/recipes", "/api/media/recipes/", "/api/auth/oauth"]
const ALLOWED_GET_EXACT = new Set(["/api/users/self"])

export function isAnonymousAllowed(method: string, pathname: string): boolean {
  if (method.toUpperCase() !== "GET") return false
  if (ALLOWED_GET_EXACT.has(pathname)) return true
  return ALLOWED_GET_PREFIXES.some(p => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(p))
}
```

> Note: `/api/auth/oauth` and `/api/recipes` use prefix matching so query strings and sub-paths pass; exact set is used for `=/api/users/self` to avoid widening to other `/api/users/*`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/server/allowlist.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/allowlist.ts src/server/allowlist.test.ts
git commit -m "feat(server): anonymous GET allowlist (no meal plans)"
```

---

## Task 5: Per-request Mealie client factory

**Files:**
- Create: `src/server/mealieClient.ts`
- Test: `src/server/mealieClient.test.ts`

**Interfaces:**
- Consumes: `mealieInternalUrl()` (Task 1); `createClient`/`createConfig` from generated client; `retryingFetch`.
- Produces: `createMealieClient(token: string)` returning a generated `Client` configured with the internal base URL, `retryingFetch`, and a Bearer header for `token`.

- [ ] **Step 1: Write the failing test**

```ts
// src/server/mealieClient.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createMealieClient } from "./mealieClient"

beforeEach(() => {
  process.env.MEALIE_INTERNAL_URL = "http://mealie:9000"
})

describe("createMealieClient", () => {
  it("sends the Bearer token to the internal base URL", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))

    const client = createMealieClient("user-token-abc")
    await client.get({ url: "/api/users/self" })

    const [input, init] = fetchMock.mock.calls[0]
    expect(String(input)).toBe("http://mealie:9000/api/users/self")
    const headers = new Headers(init?.headers)
    expect(headers.get("Authorization")).toBe("Bearer user-token-abc")
    fetchMock.mockRestore()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/server/mealieClient.test.ts`
Expected: FAIL — cannot find module `./mealieClient`.

- [ ] **Step 3: Write the implementation**

```ts
// src/server/mealieClient.ts
import { retryingFetch } from "../api/retryingFetch"
import { createClient, createConfig } from "../api/generated/client"
import { mealieInternalUrl } from "./env"

export function createMealieClient(token: string) {
  return createClient(
    createConfig({
      baseUrl: mealieInternalUrl(),
      fetch: retryingFetch,
      headers: { Authorization: `Bearer ${token}` },
    })
  )
}
```

> If `createClient`/`createConfig` are not re-exported from `../api/generated/client` (an index), import from `../api/generated/client/index` — confirm the export path in `src/api/generated/client/index.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/server/mealieClient.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/mealieClient.ts src/server/mealieClient.test.ts
git commit -m "feat(server): per-request Mealie client factory"
```

---

## Task 6: BFF proxy core

**Files:**
- Create: `src/server/proxy.ts`
- Test: `src/server/proxy.test.ts`

**Interfaces:**
- Consumes: `readSessionToken`, `isSecureRequest`, `decodeJwtExp`, `buildSessionSetCookie` (Task 3); `isAnonymousAllowed` (Task 4); `mealieInternalUrl`, `readonlyToken` (Task 1).
- Produces: `handleApiProxy(request: Request): Promise<Response>`.

Behaviour:
- Authed (valid session token): forward to Mealie with the **user token**; if `exp` is within 1h, refresh via `GET /api/auth/refresh` and add a fresh `Set-Cookie` to the response. Pass through method/body/most headers; strip client `Authorization`/`Cookie`; set `Host` + `X-Forwarded-Proto`.
- Anonymous: if `isAnonymousAllowed(method, path)` → forward with the **read-only token**; else `403`.
- Never forward the manaaki cookie to Mealie. (OIDC `session` cookie passthrough is only needed on `/api/auth/oauth`, which is GET-allowed and carries no manaaki cookie issue — we forward the original `Cookie` minus our session cookie; simplest: forward the original `Cookie` header on `/api/auth/oauth` only.)

- [ ] **Step 1: Write the failing test**

```ts
// src/server/proxy.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { buildSessionSetCookie } from "./session"
import { handleApiProxy } from "./proxy"

beforeEach(() => {
  process.env.MEALIE_INTERNAL_URL = "http://mealie:9000"
  process.env.MEALIE_READONLY_TOKEN = "ro-token"
  process.env.SESSION_SECRET = "unit-test-secret"
})

function farFutureJwt(): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url")
  return `${b64({ alg: "HS256" })}.${b64({ sub: "u1", exp: 4102444800 })}.sig`
}

function sessionCookieHeader(jwt: string): string {
  const setCookie = buildSessionSetCookie(jwt, false)
  const value = setCookie.split(";")[0].split("=").slice(1).join("=")
  return `manaaki_session=${value}`
}

describe("handleApiProxy — anonymous", () => {
  it("forwards allowed GET with the read-only token", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("[]", { status: 200 }))
    const res = await handleApiProxy(new Request("https://app/api/recipes", { headers: { "x-forwarded-proto": "https" } }))
    expect(res.status).toBe(200)
    const [input, init] = fetchMock.mock.calls[0]
    expect(String(input)).toBe("http://mealie:9000/api/recipes")
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer ro-token")
    fetchMock.mockRestore()
  })

  it("blocks meal plans for anonymous with 403", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
    const res = await handleApiProxy(new Request("https://app/api/households/mealplans"))
    expect(res.status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
    fetchMock.mockRestore()
  })

  it("blocks non-GET for anonymous with 403", async () => {
    const res = await handleApiProxy(new Request("https://app/api/recipes", { method: "POST" }))
    expect(res.status).toBe(403)
  })
})

describe("handleApiProxy — authed", () => {
  it("forwards with the user token and strips client Authorization", async () => {
    const jwt = farFutureJwt()
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }))
    const res = await handleApiProxy(
      new Request("https://app/api/households/mealplans", {
        headers: {
          "x-forwarded-proto": "https",
          cookie: sessionCookieHeader(jwt),
          authorization: "Bearer attacker",
        },
      })
    )
    expect(res.status).toBe(200)
    const [, init] = fetchMock.mock.calls[0]
    expect(new Headers(init?.headers).get("Authorization")).toBe(`Bearer ${jwt}`)
    fetchMock.mockRestore()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/server/proxy.test.ts`
Expected: FAIL — cannot find module `./proxy`.

- [ ] **Step 3: Write the implementation**

```ts
// src/server/proxy.ts
import { isAnonymousAllowed } from "./allowlist"
import { mealieInternalUrl, readonlyToken } from "./env"
import {
  buildSessionSetCookie,
  decodeJwtExp,
  isSecureRequest,
  readSessionToken,
} from "./session"

const REFRESH_WINDOW_SECONDS = 60 * 60 // refresh if < 1h to expiry
const STRIP_REQUEST_HEADERS = new Set(["authorization", "cookie", "host", "connection", "content-length"])

function upstreamHeaders(request: Request, token: string): Headers {
  const headers = new Headers()
  for (const [k, v] of request.headers) {
    if (!STRIP_REQUEST_HEADERS.has(k.toLowerCase())) headers.set(k, v)
  }
  headers.set("Authorization", `Bearer ${token}`)
  const host = request.headers.get("host")
  if (host) headers.set("Host", host)
  headers.set("X-Forwarded-Proto", isSecureRequest(request) ? "https" : "http")
  return headers
}

async function forward(request: Request, token: string, pathWithQuery: string): Promise<Response> {
  const upstream = new Request(`${mealieInternalUrl()}${pathWithQuery}`, {
    method: request.method,
    headers: upstreamHeaders(request, token),
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    // @ts-expect-error Node fetch requires duplex for streamed bodies
    duplex: "half",
  })
  return fetch(upstream)
}

async function maybeRefresh(request: Request, token: string): Promise<string | null> {
  const exp = decodeJwtExp(token)
  if (exp === null) return null
  const secondsLeft = exp - Math.floor(Date.now() / 1000)
  if (secondsLeft > REFRESH_WINDOW_SECONDS) return null
  try {
    const res = await fetch(`${mealieInternalUrl()}/api/auth/refresh`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const body = (await res.json()) as { access_token?: string }
    return typeof body.access_token === "string" ? body.access_token : null
  } catch {
    return null
  }
}

export async function handleApiProxy(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const pathWithQuery = url.pathname + url.search
  const userToken = readSessionToken(request)

  if (userToken) {
    const refreshed = await maybeRefresh(request, userToken)
    const effective = refreshed ?? userToken
    const res = await forward(request, effective, pathWithQuery)
    if (refreshed) {
      const out = new Response(res.body, res)
      out.headers.append("Set-Cookie", buildSessionSetCookie(refreshed, isSecureRequest(request)))
      return out
    }
    return res
  }

  if (!isAnonymousAllowed(request.method, url.pathname)) {
    return new Response("Forbidden", { status: 403 })
  }
  return forward(request, readonlyToken(), pathWithQuery)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/server/proxy.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/server/proxy.ts src/server/proxy.test.ts
git commit -m "feat(server): BFF proxy with tier detection, allowlist, refresh"
```

---

## Task 7: OIDC completion logic

**Files:**
- Create: `src/server/oauth.ts`
- Test: `src/server/oauth.test.ts`

**Interfaces:**
- Consumes: `mealieInternalUrl` (Task 1).
- Produces: `completeOidc(request: Request): Promise<string>` — calls Mealie `GET /api/auth/oauth/callback` forwarding the original `Cookie` (Mealie `session`) and the incoming `code`/`state` query; returns the Mealie `access_token`; throws on failure.

- [ ] **Step 1: Write the failing test**

```ts
// src/server/oauth.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { completeOidc } from "./oauth"

beforeEach(() => {
  process.env.MEALIE_INTERNAL_URL = "http://mealie:9000"
})

describe("completeOidc", () => {
  it("forwards code/state + session cookie and returns the access token", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ access_token: "mealie-jwt", token_type: "bearer" }), { status: 200 }))

    const token = await completeOidc(
      new Request("https://app/api/auth/complete?code=abc&state=xyz", {
        headers: { cookie: "session=mealie-session-cookie" },
      })
    )

    expect(token).toBe("mealie-jwt")
    const [input, init] = fetchMock.mock.calls[0]
    expect(String(input)).toBe("http://mealie:9000/api/auth/oauth/callback?code=abc&state=xyz")
    expect(new Headers(init?.headers).get("cookie")).toBe("session=mealie-session-cookie")
    fetchMock.mockRestore()
  })

  it("throws when Mealie returns no token", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 400 }))
    await expect(
      completeOidc(new Request("https://app/api/auth/complete?code=abc&state=xyz"))
    ).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/server/oauth.test.ts`
Expected: FAIL — cannot find module `./oauth`.

- [ ] **Step 3: Write the implementation**

```ts
// src/server/oauth.ts
import { mealieInternalUrl } from "./env"

export async function completeOidc(request: Request): Promise<string> {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  if (!code || !state) throw new Error("Missing code/state")

  const target = new URL(`${mealieInternalUrl()}/api/auth/oauth/callback`)
  target.searchParams.set("code", code)
  target.searchParams.set("state", state)

  const headers = new Headers()
  const cookie = request.headers.get("cookie")
  if (cookie) headers.set("cookie", cookie) // carries Mealie's state/PKCE `session` cookie

  const res = await fetch(target, { headers })
  if (!res.ok) throw new Error(`OIDC callback failed: ${res.status}`)
  const body = (await res.json()) as { access_token?: string }
  if (!body.access_token) throw new Error("OIDC callback returned no access_token")
  return body.access_token
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/server/oauth.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/oauth.ts src/server/oauth.test.ts
git commit -m "feat(server): OIDC callback completion against Mealie"
```

---

## Task 8: Server routes (splat proxy, complete, me, logout)

**Files:**
- Create: `src/routes/api.$.ts`, `src/routes/api.auth.complete.ts`, `src/routes/api.auth.me.ts`, `src/routes/api.auth.logout.ts`
- Test: `src/routes/api.auth.me.handler.test.ts` (handler-level test; see Step 1)

**Interfaces:**
- Consumes: `handleApiProxy` (Task 6), `completeOidc` (Task 7), `createMealieClient` (Task 5), session helpers (Task 3), `readonlyToken` (Task 1), `getLoggedInUserApiUsersSelfGet` from generated SDK.
- Produces: HTTP routes `/api/$` (all methods → proxy), `/api/auth/complete` (GET → seal + 302), `/api/auth/me` (GET → JSON `{ user: { groupSlug, username, ... } | null, isAnonymous }`), `/api/auth/logout` (POST → clear cookie). Exports a testable `meHandler(request)`.

- [ ] **Step 1: Write the failing test** (for the who-am-i handler logic)

```ts
// src/routes/api.auth.me.handler.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { buildSessionSetCookie } from "../server/session"
import { meHandler } from "./api.auth.me"

beforeEach(() => {
  process.env.MEALIE_INTERNAL_URL = "http://mealie:9000"
  process.env.MEALIE_READONLY_TOKEN = "ro-token"
  process.env.SESSION_SECRET = "unit-test-secret"
})

function sessionCookieHeader(jwt: string): string {
  const setCookie = buildSessionSetCookie(jwt, false)
  const value = setCookie.split(";")[0].split("=").slice(1).join("=")
  return `manaaki_session=${value}`
}

describe("meHandler", () => {
  it("anonymous: uses read-only token, returns isAnonymous true with groupSlug", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ groupSlug: "home", username: "shared" }), { status: 200 })
    )
    const res = await meHandler(new Request("https://app/api/auth/me"))
    const body = await res.json()
    expect(body.isAnonymous).toBe(true)
    expect(body.user.groupSlug).toBe("home")
    vi.restoreAllMocks()
  })

  it("authed: uses session token, returns isAnonymous false", async () => {
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url")
    const jwt = `${b64({})}.${b64({ sub: "u1", exp: 4102444800 })}.sig`
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ groupSlug: "smith", username: "alice" }), { status: 200 })
    )
    const res = await meHandler(
      new Request("https://app/api/auth/me", { headers: { cookie: sessionCookieHeader(jwt) } })
    )
    const body = await res.json()
    expect(body.isAnonymous).toBe(false)
    expect(body.user.username).toBe("alice")
    vi.restoreAllMocks()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/routes/api.auth.me.handler.test.ts`
Expected: FAIL — cannot find module `./api.auth.me`.

- [ ] **Step 3: Write the route implementations**

```ts
// src/routes/api.$.ts
import { createFileRoute } from "@tanstack/react-router"
import { handleApiProxy } from "../server/proxy"

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      GET: ({ request }) => handleApiProxy(request),
      POST: ({ request }) => handleApiProxy(request),
      PUT: ({ request }) => handleApiProxy(request),
      PATCH: ({ request }) => handleApiProxy(request),
      DELETE: ({ request }) => handleApiProxy(request),
    },
  },
})
```

```ts
// src/routes/api.auth.complete.ts
import { createFileRoute } from "@tanstack/react-router"
import { completeOidc } from "../server/oauth"
import { buildSessionSetCookie, isSecureRequest } from "../server/session"

export async function completeHandler(request: Request): Promise<Response> {
  try {
    const token = await completeOidc(request)
    const headers = new Headers({ Location: "/recipes" })
    headers.append("Set-Cookie", buildSessionSetCookie(token, isSecureRequest(request)))
    return new Response(null, { status: 302, headers })
  } catch {
    return new Response(null, { status: 302, headers: { Location: "/login?error=oauth" } })
  }
}

export const Route = createFileRoute("/api/auth/complete")({
  server: { handlers: { GET: ({ request }) => completeHandler(request) } },
})
```

```ts
// src/routes/api.auth.me.ts
import { createFileRoute } from "@tanstack/react-router"
import { getLoggedInUserApiUsersSelfGet } from "../api/generated"
import { readonlyToken } from "../server/env"
import { createMealieClient } from "../server/mealieClient"
import { readSessionToken } from "../server/session"

export async function meHandler(request: Request): Promise<Response> {
  const userToken = readSessionToken(request)
  const token = userToken ?? readonlyToken()
  const client = createMealieClient(token)
  const { data } = await getLoggedInUserApiUsersSelfGet({ client, throwOnError: false })
  return Response.json({ user: data ?? null, isAnonymous: userToken === null })
}

export const Route = createFileRoute("/api/auth/me")({
  server: { handlers: { GET: ({ request }) => meHandler(request) } },
})
```

```ts
// src/routes/api.auth.logout.ts
import { createFileRoute } from "@tanstack/react-router"
import { buildClearSessionCookie, isSecureRequest } from "../server/session"

export function logoutHandler(request: Request): Response {
  const headers = new Headers()
  headers.append("Set-Cookie", buildClearSessionCookie(isSecureRequest(request)))
  return new Response(null, { status: 204, headers })
}

export const Route = createFileRoute("/api/auth/logout")({
  server: { handlers: { POST: ({ request }) => logoutHandler(request) } },
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/routes/api.auth.me.handler.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify routing + types**

Run: `pnpm dev` briefly (regenerates `src/routeTree.gen.ts`), then `pnpm type-check`.
Expected: routeTree includes `/api/$`, `/api/auth/complete`, `/api/auth/me`, `/api/auth/logout`; type-check passes. Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add src/routes/api.$.ts src/routes/api.auth.complete.ts src/routes/api.auth.me.ts src/routes/api.auth.logout.ts src/routes/api.auth.me.handler.test.ts src/routeTree.gen.ts
git commit -m "feat(routes): BFF server routes (proxy, oidc complete, me, logout)"
```

---

## Task 9: Public SSR token + global client change

**Files:**
- Modify: `src/api/client.ts`
- Test: `src/api/client.test.ts`

**Interfaces:**
- Produces: `configureApiClient()` — server: base `MEALIE_INTERNAL_URL` + `MEALIE_READONLY_TOKEN`; browser: relative base, **no** Authorization header.

- [ ] **Step 1: Write the failing test**

```ts
// src/api/client.test.ts
import { describe, expect, it, vi } from "vitest"

describe("configureApiClient (browser)", () => {
  it("sets no Authorization header in the browser", async () => {
    vi.resetModules()
    const { client } = await import("./generated/client.gen")
    const setConfig = vi.spyOn(client, "setConfig")
    const { configureApiClient } = await import("./client")
    configureApiClient()
    const cfg = setConfig.mock.calls[0][0] as { headers?: unknown; baseUrl?: string }
    expect(cfg.headers).toBeUndefined()
    expect(cfg.baseUrl).toBe("")
    setConfig.mockRestore()
  })
})
```

(jsdom env means `window` is defined → `isServer` is false. A server-side variant can be added later under a node environment if desired.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/api/client.test.ts`
Expected: FAIL — current code sets headers / non-empty assertions differ.

- [ ] **Step 3: Update the implementation**

```ts
// src/api/client.ts
import { client } from "./generated/client.gen"
import { retryingFetch } from "./retryingFetch"

const isServer = typeof window === "undefined"
let configured = false

export function configureApiClient() {
  if (configured) {
    return
  }
  client.setConfig({
    baseUrl: isServer ? (globalThis.process?.env?.MEALIE_INTERNAL_URL ?? "") : "",
    fetch: retryingFetch,
    // Server-side SSR of PUBLIC pages uses the constant read-only token.
    // The browser sends relative /api requests; the BFF attaches the per-user
    // or read-only token from the session cookie. Never a per-user token here.
    headers:
      isServer && globalThis.process?.env?.MEALIE_READONLY_TOKEN
        ? { Authorization: `Bearer ${globalThis.process?.env?.MEALIE_READONLY_TOKEN}` }
        : undefined,
  })
  configured = true
}

export { client }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/api/client.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/api/client.ts src/api/client.test.ts
git commit -m "refactor(api): global client uses read-only token server-side, none in browser"
```

---

## Task 10: Frontend identity — useCurrentUser, useGroupSlug, auth.ts

**Files:**
- Create: `src/hooks/useCurrentUser.ts`, `src/hooks/useCurrentUser.test.tsx`
- Modify: `src/api/auth.ts`, `src/hooks/useGroupSlug.ts`
- Check: grep usages of `getCurrentUser`.

**Interfaces:**
- Produces:
  - `type CurrentUser = { user: UserOut | null; isAnonymous: boolean }`
  - `fetchCurrentUser(): Promise<CurrentUser>` (in `src/api/auth.ts`) — `GET /api/auth/me`.
  - `currentUserQueryOptions` + `useCurrentUser(): CurrentUser | undefined`.
  - `useGroupSlug()` derives `user?.groupSlug` from `useCurrentUser`.

- [ ] **Step 1: Grep current usages**

Run: `grep -rn "getCurrentUser" src/`
Expected: identify every caller (at least `useGroupSlug.ts`). All must move to the new API.

- [ ] **Step 2: Write the failing test**

```tsx
// src/hooks/useCurrentUser.test.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { useCurrentUser } from "./useCurrentUser"

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe("useCurrentUser", () => {
  it("returns the me payload", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ user: { groupSlug: "home" }, isAnonymous: true }), { status: 200 })
    )
    const { result } = renderHook(() => useCurrentUser(), { wrapper })
    await waitFor(() => expect(result.current?.isAnonymous).toBe(true))
    expect(result.current?.user?.groupSlug).toBe("home")
    vi.restoreAllMocks()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run src/hooks/useCurrentUser.test.tsx`
Expected: FAIL — cannot find module `./useCurrentUser`.

- [ ] **Step 4: Implement auth.ts + useCurrentUser + useGroupSlug**

```ts
// src/api/auth.ts
import type { UserOut } from "./generated"

export type CurrentUser = { user: UserOut | null; isAnonymous: boolean }

export async function fetchCurrentUser(): Promise<CurrentUser> {
  const res = await fetch("/api/auth/me")
  if (!res.ok) return { user: null, isAnonymous: true }
  return (await res.json()) as CurrentUser
}
```

```ts
// src/hooks/useCurrentUser.ts
import { queryOptions, useQuery } from "@tanstack/react-query"
import { type CurrentUser, fetchCurrentUser } from "../api/auth"

export const currentUserQueryOptions = queryOptions({
  queryKey: ["currentUser"],
  queryFn: fetchCurrentUser,
  staleTime: 5 * 60 * 1000,
})

export function useCurrentUser(): CurrentUser | undefined {
  const { data } = useQuery(currentUserQueryOptions)
  return data
}
```

```ts
// src/hooks/useGroupSlug.ts
import { useCurrentUser } from "./useCurrentUser"

export function useGroupSlug(): string | undefined {
  const current = useCurrentUser()
  return current?.user?.groupSlug ?? undefined
}
```

> Remove the old `groupSlugQueryOptions` export. If any code imported it, switch it to `currentUserQueryOptions`. Update any test that mocked `getCurrentUser` to mock `fetch("/api/auth/me")` instead.

- [ ] **Step 5: Run tests**

Run: `pnpm vitest run src/hooks/useCurrentUser.test.tsx && pnpm type-check`
Expected: PASS; type-check clean (fix any broken `getCurrentUser`/`groupSlugQueryOptions` importers surfaced by the grep).

- [ ] **Step 6: Commit**

```bash
git add src/api/auth.ts src/hooks/useCurrentUser.ts src/hooks/useCurrentUser.test.tsx src/hooks/useGroupSlug.ts
git commit -m "feat(web): useCurrentUser over /api/auth/me; group slug from it"
```

---

## Task 11: Frontend gating — UserMenu + plan guard + nav link

**Files:**
- Create: `src/components/UserMenu.tsx`, `src/components/UserMenu.test.tsx`
- Modify: `src/routes/recipes.index.tsx` (render `<UserMenu/>` in header), `src/routes/plan.tsx` (guard + drop SSR prefetch)

**Interfaces:**
- Consumes: `useCurrentUser` (Task 10).
- Produces: `<UserMenu/>` — when `isAnonymous`, a "Sign in" link to `/api/auth/oauth`; otherwise a "Meal Plan" link to `/plan` and a "Sign out" button that POSTs `/api/auth/logout` then reloads.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/UserMenu.test.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { UserMenu } from "./UserMenu"

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe("UserMenu", () => {
  it("shows Sign in when anonymous", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ user: null, isAnonymous: true }), { status: 200 })
    )
    render(<UserMenu />, { wrapper })
    await waitFor(() => expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/api/auth/oauth"))
    vi.restoreAllMocks()
  })

  it("shows Meal Plan + Sign out when authed", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ user: { username: "a" }, isAnonymous: false }), { status: 200 })
    )
    render(<UserMenu />, { wrapper })
    await waitFor(() => expect(screen.getByRole("link", { name: /meal plan/i })).toBeInTheDocument())
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument()
    vi.restoreAllMocks()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/UserMenu.test.tsx`
Expected: FAIL — cannot find module `./UserMenu`.

- [ ] **Step 3: Implement UserMenu**

```tsx
// src/components/UserMenu.tsx
import { Link } from "@tanstack/react-router"
import { useCurrentUser } from "../hooks/useCurrentUser"

export function UserMenu() {
  const current = useCurrentUser()
  if (!current) return null

  if (current.isAnonymous) {
    return (
      <a
        href="/api/auth/oauth"
        className="rounded-lg bg-orange-600 px-3 py-1.5 font-medium text-sm text-white transition-colors hover:bg-orange-500"
      >
        Sign in
      </a>
    )
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" })
    window.location.assign("/recipes")
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        to="/plan"
        className="rounded-lg bg-gray-800 px-3 py-1.5 font-medium text-gray-200 text-sm transition-colors hover:bg-gray-700"
      >
        Meal Plan
      </Link>
      <button
        type="button"
        onClick={signOut}
        className="rounded-lg px-3 py-1.5 font-medium text-gray-400 text-sm transition-colors hover:text-gray-200"
      >
        Sign out
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Render it in the recipes header**

In `src/routes/recipes.index.tsx`, import `UserMenu` and place it in the top header row (the `div` with the logo button + count, around line 220). Replace the right-hand cell so the count and the menu coexist:

```tsx
import { UserMenu } from "../components/UserMenu"
// ...
<div className="flex shrink-0 items-center gap-3">
  {!showSkeleton && (
    <p className="text-gray-500 text-sm">
      {isFiltered ? `${filtered.length} of ${recipes.length}` : `${recipes.length} recipes`}
    </p>
  )}
  <UserMenu />
</div>
```

- [ ] **Step 5: Guard /plan and drop its SSR prefetch**

In `src/routes/plan.tsx`, replace the route definition's `loader` with a `beforeLoad` auth guard. The meal-plan data is fetched client-side by the existing `useMealPlan` query in the component.

```tsx
import { createFileRoute, redirect } from "@tanstack/react-router"
import { fetchCurrentUser } from "../api/auth"
// ...
export const Route = createFileRoute("/plan")({
  head: () => ({ meta: [{ title: "Meal Plan · Manaaki" }] }),
  beforeLoad: async () => {
    const { isAnonymous } = await fetchCurrentUser()
    if (isAnonymous) {
      throw redirect({ href: "/api/auth/oauth" })
    }
  },
  component: PlanPage,
})
```

> Remove the previous `loader` that called `configureApiClient()` + `ensureQueryData(mealPlanQueryOptions(...))` and the now-unused imports if they are not referenced elsewhere in the file. Keep the component's `useMealPlan` usage; add the route's existing `pendingComponent` if present, or accept the component's own loading state.

- [ ] **Step 6: Run tests + type-check**

Run: `pnpm vitest run src/components/UserMenu.test.tsx && pnpm type-check`
Expected: PASS; type-check clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/UserMenu.tsx src/components/UserMenu.test.tsx src/routes/recipes.index.tsx src/routes/plan.tsx
git commit -m "feat(web): UserMenu gating + /plan auth guard"
```

---

## Task 12: /login route — OIDC return handoff

**Files:**
- Modify: `src/routes/login.tsx`
- Test: `src/routes/login.test.tsx` (sign-in render)

**Interfaces:**
- Produces: `/login` route — `validateSearch` parses optional `code`/`state`/`error`; `beforeLoad` redirects to `/api/auth/complete?code&state` when both present; otherwise renders a sign-in page with a "Sign in with Google" link to `/api/auth/oauth`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/routes/login.test.tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { LoginPage } from "./login"

describe("LoginPage", () => {
  it("offers a Google sign-in link to the OIDC initiation route", () => {
    render(<LoginPage />)
    expect(screen.getByRole("link", { name: /sign in with google/i })).toHaveAttribute(
      "href",
      "/api/auth/oauth"
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/routes/login.test.tsx`
Expected: FAIL — `LoginPage` is not exported / no such link.

- [ ] **Step 3: Implement the route**

```tsx
// src/routes/login.tsx
import { createFileRoute, redirect } from "@tanstack/react-router"

type LoginSearch = { code?: string; state?: string; error?: string }

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    code: typeof search.code === "string" ? search.code : undefined,
    state: typeof search.state === "string" ? search.state : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  beforeLoad: ({ search }) => {
    if (search.code && search.state) {
      throw redirect({
        href: `/api/auth/complete?code=${encodeURIComponent(search.code)}&state=${encodeURIComponent(search.state)}`,
      })
    }
  },
  component: LoginPage,
})

export function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-950 px-6 text-center text-gray-100">
      <h1 className="font-bold text-3xl">Sign in to Manaaki</h1>
      <p className="max-w-sm text-gray-400">
        Browsing recipes is open to everyone. Sign in to use your meal planner and household features.
      </p>
      <a
        href="/api/auth/oauth"
        className="rounded-lg bg-orange-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-orange-500"
      >
        Sign in with Google
      </a>
    </main>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/routes/login.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/login.tsx src/routes/login.test.tsx
git commit -m "feat(web): /login OIDC return handoff + sign-in page"
```

---

## Task 13: Dev config — vite proxy removal + env loading

**Files:**
- Modify: `vite.config.ts`
- Modify: `.env.example`

- [ ] **Step 1: Update vite.config.ts**

Remove the `/api` proxy block (so `/api/*` hits the BFF server routes in dev) and populate `process.env` from `.env` for dev server code (Vite does not auto-load non-`VITE_` vars into `process.env`). Keep the PostHog `/ingest*` proxies.

```ts
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  // Make server-only vars available to BFF server routes during `vite dev`.
  for (const key of ["MEALIE_INTERNAL_URL", "MEALIE_READONLY_TOKEN", "SESSION_SECRET"]) {
    if (env[key]) process.env[key] = env[key]
  }

  const buildSha = env.VITE_BUILD_GIT_SHORT_SHA ?? "dev"

  return {
    server: {
      port: Number(process.env.PORT) || 3000,
      proxy: {
        "/ingest/static": { target: "https://eu-assets.i.posthog.com", changeOrigin: true, rewrite: p => p.replace(/^\/ingest/, "") },
        "/ingest/array": { target: "https://eu-assets.i.posthog.com", changeOrigin: true, rewrite: p => p.replace(/^\/ingest/, "") },
        "/ingest": { target: "https://eu.i.posthog.com", changeOrigin: true, rewrite: p => p.replace(/^\/ingest/, "") },
      },
    },
    resolve: { tsconfigPaths: true },
    build: { sourcemap: true },
    plugins: [emitVersionJson(buildSha), svgr(), tanstackStart(), viteReact()],
  }
})
```

> Remove the now-unused `mealieBaseUrl`/`mealieToken` consts.

- [ ] **Step 2: Update .env.example**

Add/replace the Mealie + session vars:

```
# Server-to-server URL for your Mealie instance (Docker-internal)
MEALIE_INTERNAL_URL=http://mealie:9000
# Shared token used for anonymous, read-only recipe browsing
MEALIE_READONLY_TOKEN=
# Secret used to encrypt the manaaki session cookie (any long random string)
SESSION_SECRET=
```

- [ ] **Step 3: Manual dev smoke test**

Run: `pnpm dev`, then in another shell:
- `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/recipes` → `200`
- `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/households/mealplans` → `403`
- `curl -s http://localhost:3000/api/auth/me` → JSON with `"isAnonymous":true`

Expected: codes as above. Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts .env.example
git commit -m "chore(dev): route /api through the BFF in dev; load server env"
```

---

## Task 14: Production config — nginx forwards /api to the BFF

**Files:**
- Modify: `nginx.conf.template`, `Dockerfile`, `docker-entrypoint.sh`

- [ ] **Step 1: Update nginx.conf.template**

Replace the four Mealie `location` blocks (`/api/recipes`, `/api/households/mealplans`, `=/api/users/self`, `/api/media/recipes/`) and the `location /api/ { return 403; }` block with a single block that forwards all `/api/*` to the SSR/BFF server. Keep the `/ingest*` blocks, asset/caching blocks, and the `@ssr` block. Add a `/api/` location:

```nginx
    location /api/ {
        resolver 127.0.0.11 valid=10s;
        proxy_pass $ssr_server;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }
```

> Delete the `set $mealie ...;` line and the `mealie-proxy-headers.conf` include references. `proxy_buffering off` keeps streaming/SSE-safe passthrough. The BFF (node) now holds the tokens and sets the upstream `Host`/`X-Forwarded-Proto` to Mealie itself.

- [ ] **Step 2: Update docker-entrypoint.sh**

Remove the Mealie token + proxy-headers substitution; keep only what nginx still needs.

```sh
#!/bin/sh
set -eu

envsubst '${MEALIE_INTERNAL_URL}' \
  < /etc/nginx/conf-templates/nginx.conf.template \
  > /etc/nginx/conf.d/default.conf

node /app/server.js &

exec nginx -g 'daemon off;'
```

> `MEALIE_INTERNAL_URL` is still substituted only if the template still references it; if the template no longer uses `$mealie`, this envsubst is harmless. The node server reads `MEALIE_INTERNAL_URL`, `MEALIE_READONLY_TOKEN`, `SESSION_SECRET` from its own environment.

- [ ] **Step 3: Update Dockerfile**

Remove the `mealie-proxy-headers.conf.template` COPY (line ~67) and update the trailing required-env comment.

```dockerfile
COPY nginx.conf.template /etc/nginx/conf-templates/nginx.conf.template
# (mealie-proxy-headers template removed — the node BFF owns Mealie auth)

# Required at runtime: MEALIE_INTERNAL_URL, MEALIE_READONLY_TOKEN, SESSION_SECRET
```

Also delete the file `mealie-proxy-headers.conf.template` from the repo if nothing else references it (grep first).

- [ ] **Step 4: Build smoke test**

Run: `docker build -t manaaki-test .`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add nginx.conf.template docker-entrypoint.sh Dockerfile
git rm mealie-proxy-headers.conf.template 2>/dev/null || true
git commit -m "chore(deploy): nginx forwards /api to the BFF; drop nginx Mealie token"
```

---

## Task 15: Full validation + manual end-to-end

**Files:** none (verification only)

- [ ] **Step 1: Run the whole suite + type-check + lint**

Run: `pnpm validate && pnpm test`
Expected: type-check, biome, and all vitest tests pass.

- [ ] **Step 2: Manual OIDC end-to-end (against a real/staging Mealie)**

Preconditions (document in the PR, do not automate here): Mealie `BASE_URL` unset/default; Google OAuth client has `https://<manaaki-host>/login` (and `https://<mealie-host>/login`) as redirect URIs; `MEALIE_READONLY_TOKEN` + `SESSION_SECRET` set.

Verify:
- Anonymous: `/recipes` loads and lists recipes; "View in Mealie" link resolves (group slug present); `/plan` redirects to sign-in.
- Click **Sign in** → Google → returns to `/login?code…` → lands on `/recipes` authed; `UserMenu` shows Meal Plan + Sign out.
- `/plan` now loads the signed-in user's household plan.
- Browser devtools: the `__Host-manaaki_session` cookie is `HttpOnly` and not readable via `document.cookie`.
- **Sign out** → cookie cleared → `/plan` redirects again.

- [ ] **Step 3: Final commit (if any doc tweaks)**

```bash
git add -A && git commit -m "test: validate auth foundation end-to-end" || true
```

---

## Self-Review (completed during authoring)

- **Spec coverage:** Routing model (Task 14), per-request client (Task 5, 8), three tiers (Task 4, 6), OIDC fronting + Host/XFP (Task 6, 7, 12, 14), cookie `__Host-`/seal/refresh (Task 3, 6), who-am-i both tiers + group slug (Task 8, 10, 11), `/login` loader (Task 12), dev proxy + env (Task 13), public SSR token / global-client race fix (Task 9), logout (Task 8, 11), `.env.example` (Task 13). Deferred items (history, shopping, sanitization, admin-UI fallback, BASE_URL monitoring) intentionally excluded.
- **Placeholders:** none — every code step is complete.
- **Type consistency:** `fetchCurrentUser`/`CurrentUser`/`currentUserQueryOptions`/`useCurrentUser`/`useGroupSlug` consistent across Tasks 10–12; `handleApiProxy`/`completeOidc`/`meHandler`/`logoutHandler`/`completeHandler` names match between server modules (Tasks 6–8) and their tests; session helper names consistent (Task 3 ↔ 6, 8).
- **Known follow-ups for the implementer:** confirm `createClient`/`createConfig` export path (Task 5 note); confirm route precedence in `routeTree.gen.ts` (Task 8 note); Node `fetch` streaming bodies need `duplex: "half"` (Task 6).
```
