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
      new Response(JSON.stringify({ groupSlug: "home", username: "shared" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
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
      new Response(JSON.stringify({ groupSlug: "smith", username: "alice" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
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
