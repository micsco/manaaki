// src/server/proxy.test.ts
import * as http from "node:http"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { handleApiProxy } from "./proxy"
import { buildSessionSetCookie, unsealSession } from "./session"

// ---------------------------------------------------------------------------
// Minimal local upstream server
// ---------------------------------------------------------------------------

interface UpstreamRequest {
  method: string
  url: string
  headers: http.IncomingHttpHeaders
  body: string
}

interface UpstreamResponse {
  status?: number
  headers?: Record<string, string | string[]>
  body?: string | Buffer
}

let server: http.Server
let serverPort: number
let lastUpstreamRequest: UpstreamRequest | null = null
let nextUpstreamResponse: UpstreamResponse = { status: 200, body: "{}" }

// Optional per-path override so refresh tests can serve different endpoints.
let perPathResponses: Map<string, UpstreamResponse> = new Map()

function setNextResponse(res: UpstreamResponse) {
  nextUpstreamResponse = res
}

function setPathResponse(path: string, res: UpstreamResponse) {
  perPathResponses.set(path, res)
}

function startServer(): Promise<void> {
  return new Promise(resolve => {
    server = http.createServer((req, res) => {
      let rawBody = ""
      req.on("data", chunk => {
        rawBody += chunk
      })
      req.on("end", () => {
        lastUpstreamRequest = {
          method: req.method ?? "GET",
          url: req.url ?? "/",
          headers: req.headers,
          body: rawBody,
        }

        const matchedPath = req.url ? perPathResponses.get(req.url.split("?")[0]) : undefined
        const response = matchedPath ?? nextUpstreamResponse
        const status = response.status ?? 200
        const body = response.body ?? ""

        res.writeHead(status, response.headers ?? {})
        res.end(body)
      })
    })
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as { port: number }
      serverPort = addr.port
      resolve()
    })
  })
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

beforeEach(async () => {
  await startServer()
  process.env.MEALIE_INTERNAL_URL = `http://127.0.0.1:${serverPort}`
  process.env.MEALIE_READONLY_TOKEN = "ro-token"
  process.env.SESSION_SECRET = "unit-test-secret"
  lastUpstreamRequest = null
  nextUpstreamResponse = { status: 200, body: "{}" }
  perPathResponses = new Map()
})

afterEach(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()))
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function farFutureJwt(): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url")
  return `${b64({ alg: "HS256" })}.${b64({ sub: "u1", exp: 4102444800 })}.sig`
}

function sessionCookieHeader(jwt: string): string {
  const setCookie = buildSessionSetCookie(jwt, true)
  const value = setCookie.split(";")[0].split("=").slice(1).join("=")
  return `__Host-manaaki_session=${value}`
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("handleApiProxy — Host regression (the fix)", () => {
  it("sends the public Host header to the upstream, not the internal docker host", async () => {
    setNextResponse({ status: 200, body: "[]" })
    const res = await handleApiProxy(
      new Request("https://app/api/recipes", {
        headers: {
          host: "manaaki.micsco.nz",
          "x-forwarded-proto": "https",
        },
      })
    )
    expect(res.status).toBe(200)
    expect(lastUpstreamRequest).not.toBeNull()
    // The core assertion: upstream must see the public host, NOT 127.0.0.1
    expect(lastUpstreamRequest?.headers.host).toBe("manaaki.micsco.nz")
    expect(lastUpstreamRequest?.headers.authorization).toBe("Bearer ro-token")
  })
})

describe("handleApiProxy — anonymous", () => {
  it("forwards allowed GET /api/recipes with the read-only token", async () => {
    setNextResponse({ status: 200, body: "[]" })
    const res = await handleApiProxy(
      new Request("https://app/api/recipes", {
        headers: { host: "manaaki.micsco.nz", "x-forwarded-proto": "https" },
      })
    )
    expect(res.status).toBe(200)
    expect(lastUpstreamRequest?.headers.authorization).toBe("Bearer ro-token")
    expect(lastUpstreamRequest?.url).toBe("/api/recipes")
  })

  it("blocks meal plans for anonymous with 403 — no upstream request made", async () => {
    const res = await handleApiProxy(
      new Request("https://app/api/households/mealplans", {
        headers: { host: "manaaki.micsco.nz" },
      })
    )
    expect(res.status).toBe(403)
    expect(lastUpstreamRequest).toBeNull()
  })

  it("blocks non-GET (POST /api/recipes) for anonymous with 403 — no upstream request", async () => {
    const res = await handleApiProxy(
      new Request("https://app/api/recipes", {
        method: "POST",
        headers: { host: "manaaki.micsco.nz" },
      })
    )
    expect(res.status).toBe(403)
    expect(lastUpstreamRequest).toBeNull()
  })
})

describe("handleApiProxy — authed", () => {
  it("forwards with the user token, strips client Authorization and cookie, sets Cache-Control", async () => {
    const jwt = farFutureJwt()
    setNextResponse({ status: 200, body: "{}" })
    const res = await handleApiProxy(
      new Request("https://app/api/households/mealplans", {
        headers: {
          host: "manaaki.micsco.nz",
          "x-forwarded-proto": "https",
          cookie: sessionCookieHeader(jwt),
          authorization: "Bearer attacker",
        },
      })
    )
    expect(res.status).toBe(200)
    // JWT from session, not the attacker token
    expect(lastUpstreamRequest?.headers.authorization).toBe(`Bearer ${jwt}`)
    // Cookie must be stripped
    expect(lastUpstreamRequest?.headers.cookie).toBeUndefined()
    // Public host forwarded
    expect(lastUpstreamRequest?.headers.host).toBe("manaaki.micsco.nz")
    // Authed responses must be private
    expect(res.headers.get("Cache-Control")).toBe("private, no-store")
  })
})

describe("handleApiProxy — redirect passthrough", () => {
  it("passes upstream 302 through to the browser without following it", async () => {
    const googleUrl = "https://accounts.google.com/o/oauth2/v2/auth?x=1"
    setNextResponse({
      status: 302,
      headers: { Location: googleUrl },
      body: "",
    })
    const res = await handleApiProxy(
      new Request("https://app/api/auth/oauth", {
        headers: { host: "manaaki.micsco.nz", "x-forwarded-proto": "https" },
      })
    )
    expect(res.status).toBe(302)
    expect(res.headers.get("Location")).toBe(googleUrl)
  })
})

describe("handleApiProxy — refresh near-expiry token", () => {
  it("refreshes a near-expiry token and sets a fresh session cookie", async () => {
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url")
    const nearExpireJwt = `${b64({ alg: "HS256" })}.${b64({ sub: "u1", exp: Math.floor(Date.now() / 1000) + 60 })}.sig`

    // /api/auth/refresh → returns new access_token
    setPathResponse("/api/auth/refresh", {
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ access_token: "refreshed-jwt" }),
    })
    // The actual forwarded request → 200
    nextUpstreamResponse = { status: 200, body: "{}" }

    const res = await handleApiProxy(
      new Request("https://app/api/households/mealplans", {
        headers: {
          host: "manaaki.micsco.nz",
          "x-forwarded-proto": "https",
          cookie: sessionCookieHeader(nearExpireJwt),
        },
      })
    )
    expect(res.status).toBe(200)

    // Fresh session cookie must be set
    const setCookieHeader = res.headers.get("set-cookie")
    expect(setCookieHeader).toBeTruthy()
    expect(setCookieHeader).toContain("__Host-manaaki_session")

    // Unsealed value must be the refreshed JWT
    const cookieValue = (setCookieHeader ?? "").split(";")[0].split("=").slice(1).join("=")
    const unsealed = unsealSession(cookieValue)
    expect(unsealed).toBe("refreshed-jwt")

    // The forwarded real request carried the refreshed token
    expect(lastUpstreamRequest?.headers.authorization).toBe("Bearer refreshed-jwt")
  })
})

describe("handleApiProxy — content-encoding passthrough", () => {
  it("retains content-encoding: gzip from upstream (node:http does not decompress)", async () => {
    // Simulate a gzip-encoded response; body bytes can be arbitrary for this test.
    const fakeGzipBody = Buffer.from([0x1f, 0x8b, 0x08, 0x00])
    setNextResponse({
      status: 200,
      headers: {
        "content-type": "application/json",
        "content-encoding": "gzip",
        "content-length": String(fakeGzipBody.length),
      },
      body: fakeGzipBody,
    })
    const res = await handleApiProxy(
      new Request("https://app/api/recipes", {
        headers: { host: "manaaki.micsco.nz", "x-forwarded-proto": "https" },
      })
    )
    expect(res.status).toBe(200)
    // content-encoding MUST be preserved — we stream raw bytes, not decoded body
    expect(res.headers.get("content-encoding")).toBe("gzip")
    // content-length MUST also be preserved
    expect(res.headers.get("content-length")).toBe(String(fakeGzipBody.length))
  })
})
