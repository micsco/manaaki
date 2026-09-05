import { createHash } from "node:crypto"
import * as http from "node:http"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  beginNativeLogin,
  buildClearLoginAttemptCookie,
  completeNativeLogin,
  readLoginAttempt,
} from "./nativeOidc"

interface UpstreamRequest {
  method: string
  url: string
  body: string
}

let server: http.Server
let upstreamRequests: UpstreamRequest[] = []
let tokenResponse: { status: number; body: string } = {
  status: 200,
  body: JSON.stringify({ access_token: "mealie-jwt", token_type: "bearer", expires_in: 172800 }),
}

const providerConfig = {
  authorization_endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  client_id: "google-client-id",
  scope: "openid email profile",
}

function startServer(): Promise<void> {
  return new Promise(resolve => {
    server = http.createServer((req, res) => {
      let rawBody = ""
      req.on("data", chunk => {
        rawBody += chunk
      })
      req.on("end", () => {
        upstreamRequests.push({ method: req.method ?? "GET", url: req.url ?? "/", body: rawBody })
        if (req.url === "/api/auth/oauth/native/config") {
          res.writeHead(200, { "content-type": "application/json" })
          res.end(JSON.stringify(providerConfig))
          return
        }
        if (req.url === "/api/auth/oauth/native/token") {
          res.writeHead(tokenResponse.status, { "content-type": "application/json" })
          res.end(tokenResponse.body)
          return
        }
        res.writeHead(404)
        res.end()
      })
    })
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as { port: number }
      process.env.MEALIE_INTERNAL_URL = `http://127.0.0.1:${port}`
      resolve()
    })
  })
}

beforeEach(async () => {
  process.env.SESSION_SECRET = "unit-test-secret"
  upstreamRequests = []
  tokenResponse = {
    status: 200,
    body: JSON.stringify({ access_token: "mealie-jwt", token_type: "bearer", expires_in: 172800 }),
  }
  await startServer()
})

afterEach(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()))
})

function startRequest(): Request {
  return new Request("https://app/api/auth/oauth", {
    headers: { host: "manaaki.micsco.nz", "x-forwarded-proto": "https" },
  })
}

function cookieHeaderFrom(setCookie: string): string {
  return setCookie.split(";")[0]
}

async function startLogin(): Promise<{ location: URL; cookie: string }> {
  const res = await beginNativeLogin(startRequest())
  const setCookie = res.headers.get("set-cookie") ?? ""
  return {
    location: new URL(res.headers.get("location") ?? ""),
    cookie: cookieHeaderFrom(setCookie),
  }
}

function completeRequest(query: string, cookie?: string): Request {
  return new Request(`https://app/api/auth/complete?${query}`, {
    headers: {
      host: "manaaki.micsco.nz",
      "x-forwarded-proto": "https",
      ...(cookie ? { cookie } : {}),
    },
  })
}

function sha256Base64Url(value: string): string {
  return createHash("sha256").update(value).digest("base64url")
}

describe("beginNativeLogin", () => {
  it("redirects to the provider with PKCE, state, nonce and manaaki's own /login return address", async () => {
    const res = await beginNativeLogin(startRequest())

    expect(res.status).toBe(302)
    const location = new URL(res.headers.get("location") ?? "")
    expect(location.origin + location.pathname).toBe(providerConfig.authorization_endpoint)
    expect(location.searchParams.get("client_id")).toBe("google-client-id")
    expect(location.searchParams.get("response_type")).toBe("code")
    expect(location.searchParams.get("scope")).toBe("openid email profile")
    expect(location.searchParams.get("redirect_uri")).toBe("https://manaaki.micsco.nz/login")
    expect(location.searchParams.get("code_challenge_method")).toBe("S256")

    const attempt = readLoginAttempt(
      new Request("https://app/x", {
        headers: {
          "x-forwarded-proto": "https",
          cookie: cookieHeaderFrom(res.headers.get("set-cookie") ?? ""),
        },
      })
    )
    expect(attempt).not.toBeNull()
    expect(location.searchParams.get("state")).toBe(attempt?.state)
    expect(location.searchParams.get("nonce")).toBe(attempt?.nonce)
    expect(location.searchParams.get("code_challenge")).toBe(
      sha256Base64Url(attempt?.codeVerifier ?? "")
    )
  })

  it("stores the login attempt in a short-lived, HttpOnly, host-only cookie", async () => {
    const res = await beginNativeLogin(startRequest())
    const setCookie = res.headers.get("set-cookie") ?? ""

    expect(setCookie).toMatch(/^__Host-manaaki_oidc=/)
    expect(setCookie).toContain("HttpOnly")
    expect(setCookie).toContain("Secure")
    expect(setCookie).toContain("SameSite=Lax")
    expect(setCookie).toContain("Max-Age=600")
    expect(setCookie).not.toContain(res.headers.get("location") ?? "unreachable")
  })

  it("generates a fresh state and verifier for every attempt", async () => {
    const first = await startLogin()
    const second = await startLogin()
    expect(first.location.searchParams.get("state")).not.toBe(
      second.location.searchParams.get("state")
    )
    expect(first.cookie).not.toBe(second.cookie)
  })
})

describe("completeNativeLogin", () => {
  it("exchanges the code through Mealie's native token endpoint with the stored verifier", async () => {
    const { location, cookie } = await startLogin()
    const state = location.searchParams.get("state") ?? ""
    const attempt = readLoginAttempt(
      new Request("https://app/x", { headers: { "x-forwarded-proto": "https", cookie } })
    )

    const token = await completeNativeLogin(
      completeRequest(`code=auth-code&state=${state}`, cookie)
    )

    expect(token).toBe("mealie-jwt")
    const exchange = upstreamRequests.find(r => r.url === "/api/auth/oauth/native/token")
    expect(exchange?.method).toBe("POST")
    expect(JSON.parse(exchange?.body ?? "{}")).toEqual({
      code: "auth-code",
      code_verifier: attempt?.codeVerifier,
      redirect_uri: "https://manaaki.micsco.nz/login",
      nonce: attempt?.nonce,
    })
  })

  it("rejects a state that does not match the stored attempt without contacting Mealie", async () => {
    const { cookie } = await startLogin()
    upstreamRequests = []

    await expect(
      completeNativeLogin(completeRequest("code=auth-code&state=forged", cookie))
    ).rejects.toThrow(/state/i)
    expect(upstreamRequests).toEqual([])
  })

  it("rejects when no login attempt cookie is present", async () => {
    await expect(
      completeNativeLogin(completeRequest("code=auth-code&state=whatever"))
    ).rejects.toThrow()
    expect(upstreamRequests).toEqual([])
  })

  it("rejects when Mealie refuses the exchange", async () => {
    const { location, cookie } = await startLogin()
    tokenResponse = { status: 401, body: JSON.stringify({ detail: "Unauthorized" }) }

    await expect(
      completeNativeLogin(
        completeRequest(`code=auth-code&state=${location.searchParams.get("state")}`, cookie)
      )
    ).rejects.toThrow(/401/)
  })
})

describe("buildClearLoginAttemptCookie", () => {
  it("expires the attempt cookie under the same name and flags", () => {
    const cleared = buildClearLoginAttemptCookie(true)
    expect(cleared).toMatch(/^__Host-manaaki_oidc=;/)
    expect(cleared).toContain("Max-Age=0")
    expect(cleared).toContain("Secure")
  })
})
