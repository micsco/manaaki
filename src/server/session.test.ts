import { beforeEach, describe, expect, it } from "vitest"

import {
  buildClearSessionCookie,
  buildSessionSetCookie,
  decodeJwtTiming,
  isSecureRequest,
  readSessionToken,
  SESSION_COOKIE_NAME,
  sealSession,
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
