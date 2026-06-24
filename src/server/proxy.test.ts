// src/server/proxy.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { handleApiProxy } from "./proxy"
import { buildSessionSetCookie } from "./session"

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
})
