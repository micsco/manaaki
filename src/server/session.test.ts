import { beforeEach, describe, expect, it } from "vitest"

import {
  buildClearSessionCookie,
  buildSessionSetCookie,
  decodeJwtSubject,
  decodeJwtTiming,
  isSecureRequest,
  hasLiveSession,
  readSession,
  readSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_LIFETIME_SECONDS,
  sealJson,
  sealSession,
  unsealJson,
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
  it("prevents cross-purpose cookie replay via AAD", () => {
    const oidcPayload = sealJson({ t: "forged-jwt" }, "oidc")
    expect(unsealSession(oidcPayload)).toBeNull()
    expect(unsealJson(oidcPayload, "known")).toBeNull()
    expect(unsealJson(oidcPayload, "oidc")).toEqual({ t: "forged-jwt" })
  })
})

describe("absolute session lifetime", () => {
  const now = () => Math.floor(Date.now() / 1000)

  it("accepts a session signed in within the lifetime", () => {
    expect(unsealSession(sealSession("my-jwt", now() - SESSION_LIFETIME_SECONDS + 60))).toBe(
      "my-jwt"
    )
  })

  it("rejects a session signed in longer ago than the lifetime, however often it refreshed", () => {
    expect(unsealSession(sealSession("my-jwt", now() - SESSION_LIFETIME_SECONDS))).toBeNull()
  })

  it("rejects sessions sealed before sign-in times were recorded", () => {
    expect(unsealSession(sealJson({ t: "my-jwt" }, "session"))).toBeNull()
  })

  it("still reads an over-age session as present so the proxy can clear it", () => {
    const sealed = buildSessionSetCookie("my-jwt", false, now() - SESSION_LIFETIME_SECONDS)
    const value = sealed.split(";")[0].split("=").slice(1).join("=")
    const request = new Request("http://x/", { headers: { cookie: `manaaki_session=${value}` } })
    expect(readSession(request)).toMatchObject({ token: "my-jwt", expired: true })
    expect(readSessionToken(request)).toBeNull()
  })

  it("keeps the cookie long enough for the server to see and clear an over-age session", () => {
    expect(buildSessionSetCookie("jwt", true, now() - SESSION_LIFETIME_SECONDS + 3600)).toContain(
      `Max-Age=${SESSION_LIFETIME_SECONDS}`
    )
  })
})

describe("hasLiveSession", () => {
  const requestWith = (jwt: string) => {
    const value = buildSessionSetCookie(jwt, false).split(";")[0].split("=").slice(1).join("=")
    return new Request("http://x/", { headers: { cookie: `manaaki_session=${value}` } })
  }
  const now = () => Math.floor(Date.now() / 1000)

  it("is true for an unexpired Mealie token", () => {
    expect(hasLiveSession(requestWith(fakeJwt({ exp: now() + 3600 })))).toBe(true)
  })

  it("is false once the Mealie token inside the cookie has expired", () => {
    expect(hasLiveSession(requestWith(fakeJwt({ exp: now() - 1 })))).toBe(false)
  })

  it("treats a token without an expiry as live", () => {
    expect(hasLiveSession(requestWith("opaque-token"))).toBe(true)
  })

  it("is false once the session has passed its absolute lifetime", () => {
    const value = buildSessionSetCookie(
      fakeJwt({ exp: now() + 3600 }),
      false,
      now() - SESSION_LIFETIME_SECONDS
    )
      .split(";")[0]
      .split("=")
      .slice(1)
      .join("=")
    const request = new Request("http://x/", { headers: { cookie: `manaaki_session=${value}` } })
    expect(hasLiveSession(request)).toBe(false)
  })

  it("is false without a session cookie", () => {
    expect(hasLiveSession(new Request("http://x/"))).toBe(false)
  })
})

describe("decodeJwtSubject", () => {
  it("reads the sub claim when present", () => {
    expect(decodeJwtSubject(fakeJwt({ sub: "user-42", exp: 1893456000 }))).toBe("user-42")
    expect(decodeJwtSubject(fakeJwt({ exp: 1893456000 }))).toBeNull()
    expect(decodeJwtSubject("opaque-token")).toBeNull()
  })
})

describe("decodeJwtTiming", () => {
  it("reads the exp and iat claims", () => {
    expect(decodeJwtTiming(fakeJwt({ exp: 1893456000, iat: 1893283200 }))).toEqual({
      exp: 1893456000,
      iat: 1893283200,
    })
  })
  it("reports a null iat for tokens minted without one", () => {
    expect(decodeJwtTiming(fakeJwt({ exp: 1893456000 }))).toEqual({ exp: 1893456000, iat: null })
  })
  it("returns null when malformed", () => {
    expect(decodeJwtTiming("nope")).toBeNull()
  })
  it("returns null when exp is missing", () => {
    expect(decodeJwtTiming(fakeJwt({ iat: 1893283200 }))).toBeNull()
  })
})

describe("cookie name + flags", () => {
  it("uses __Host- prefix only when secure", () => {
    expect(SESSION_COOKIE_NAME(true)).toBe("__Host-manaaki_session")
    expect(SESSION_COOKIE_NAME(false)).toBe("manaaki_session")
  })
  it("isSecureRequest reads X-Forwarded-Proto", () => {
    expect(
      isSecureRequest(new Request("http://x/", { headers: { "x-forwarded-proto": "https" } }))
    ).toBe(true)
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
