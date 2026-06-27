// src/server/proxy.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { handleApiProxy } from "./proxy"
import { buildSessionSetCookie, unsealSession } from "./session"

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
  const setCookie = buildSessionSetCookie(jwt, true)
  const value = setCookie.split(";")[0].split("=").slice(1).join("=")
  return `__Host-manaaki_session=${value}`
}

describe("handleApiProxy — anonymous", () => {
  it("forwards allowed GET with the read-only token", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("[]", { status: 200 }))
    const res = await handleApiProxy(
      new Request("https://app/api/recipes", { headers: { "x-forwarded-proto": "https" } })
    )
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

  it("refreshes a near-expiry token and sets a fresh session cookie", async () => {
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url")
    const nearExpireJwt = `${b64({ alg: "HS256" })}.${b64({ sub: "u1", exp: Math.floor(Date.now() / 1000) + 60 })}.sig`
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(input => {
      const urlStr = String(input)
      if (urlStr.includes("/api/auth/refresh")) {
        return Promise.resolve(
          new Response(JSON.stringify({ access_token: "refreshed-jwt" }), { status: 200 })
        )
      }
      return Promise.resolve(new Response("{}", { status: 200 }))
    })
    const res = await handleApiProxy(
      new Request("https://app/api/households/mealplans", {
        headers: {
          "x-forwarded-proto": "https",
          cookie: sessionCookieHeader(nearExpireJwt),
        },
      })
    )
    expect(res.status).toBe(200)
    const setCookieHeader = res.headers.get("set-cookie")
    expect(setCookieHeader).toBeTruthy()
    expect(setCookieHeader).toContain("__Host-manaaki_session")
    const cookieValue = (setCookieHeader ?? "").split(";")[0].split("=").slice(1).join("=")
    const unsealed = unsealSession(cookieValue)
    expect(unsealed).toBe("refreshed-jwt")
    const [, refreshInit] = fetchMock.mock.calls[0]
    expect(new Headers(refreshInit?.headers).get("Authorization")).toBe(`Bearer ${nearExpireJwt}`)
    const [, forwardInit] = fetchMock.mock.calls[1]
    expect(new Headers(forwardInit?.headers).get("Authorization")).toBe("Bearer refreshed-jwt")
    fetchMock.mockRestore()
  })

  it("does not forward the manaaki session cookie to Mealie", async () => {
    const jwt = farFutureJwt()
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }))
    await handleApiProxy(
      new Request("https://app/api/households/mealplans", {
        headers: {
          "x-forwarded-proto": "https",
          cookie: sessionCookieHeader(jwt),
        },
      })
    )
    const [, init] = fetchMock.mock.calls[0]
    expect(new Headers(init?.headers).get("cookie")).toBeNull()
    expect(new Headers(init?.headers).get("Authorization")).toBe(`Bearer ${jwt}`)
    fetchMock.mockRestore()
  })

  it("marks authed responses private, no-store", async () => {
    const jwt = farFutureJwt()
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }))
    const res = await handleApiProxy(
      new Request("https://app/api/households/mealplans", {
        headers: {
          "x-forwarded-proto": "https",
          cookie: sessionCookieHeader(jwt),
        },
      })
    )
    expect(res.headers.get("Cache-Control")).toBe("private, no-store")
    fetchMock.mockRestore()
  })
})

describe("handleApiProxy — redirect passthrough", () => {
  it("passes upstream redirects through to the browser", async () => {
    const googleUrl = "https://accounts.google.com/o/oauth2/v2/auth?x=1"
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 302, headers: { Location: googleUrl } }))
    const res = await handleApiProxy(
      new Request("https://app/api/auth/oauth", { headers: { "x-forwarded-proto": "https" } })
    )
    expect(res.status).toBe(302)
    expect(res.headers.get("Location")).toBe(googleUrl)
    const [, init] = fetchMock.mock.calls[0]
    expect((init as RequestInit & { redirect?: string }).redirect).toBe("manual")
    fetchMock.mockRestore()
  })
})

describe("handleApiProxy — decoded-body framing headers", () => {
  // undici decompresses the upstream body, so passing the upstream
  // content-encoding/content-length through makes nginx see more bytes than
  // declared. The proxy must strip them and let the runtime re-frame.
  it("drops stale content-encoding/content-length on anonymous responses", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("[1,2,3]", {
        status: 200,
        headers: { "content-encoding": "gzip", "content-length": "9" },
      })
    )
    const res = await handleApiProxy(
      new Request("https://app/api/recipes", { headers: { "x-forwarded-proto": "https" } })
    )
    expect(res.status).toBe(200)
    expect(res.headers.get("content-encoding")).toBeNull()
    expect(res.headers.get("content-length")).toBeNull()
    await expect(res.text()).resolves.toBe("[1,2,3]")
    fetchMock.mockRestore()
  })

  it("drops stale content-encoding/content-length on authed responses", async () => {
    const jwt = farFutureJwt()
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", {
        status: 200,
        headers: { "content-encoding": "br", "content-length": "4" },
      })
    )
    const res = await handleApiProxy(
      new Request("https://app/api/households/mealplans", {
        headers: { "x-forwarded-proto": "https", cookie: sessionCookieHeader(jwt) },
      })
    )
    expect(res.status).toBe(200)
    expect(res.headers.get("content-encoding")).toBeNull()
    expect(res.headers.get("content-length")).toBeNull()
    fetchMock.mockRestore()
  })
})

describe("handleApiProxy — anonymous cache headers", () => {
  it("does not set Cache-Control: private, no-store on anonymous allowed GET", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("[]", { status: 200 }))
    const res = await handleApiProxy(
      new Request("https://app/api/recipes", { headers: { "x-forwarded-proto": "https" } })
    )
    expect(res.headers.get("Cache-Control")).not.toBe("private, no-store")
    fetchMock.mockRestore()
  })
})
