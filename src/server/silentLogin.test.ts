import { beforeEach, describe, expect, it } from "vitest"

import { buildSessionSetCookie } from "./session"
import {
  buildClearKnownDeviceCookie,
  buildKnownDeviceSetCookie,
  buildSilentAttemptMarkerCookie,
  handleSilentLoginRequest,
  hasRecentSilentAttempt,
  readKnownDevice,
  safeReturnPath,
  silentLoginRedirect,
} from "./silentLogin"

beforeEach(() => {
  process.env.SESSION_SECRET = "unit-test-secret"
})

function cookiePair(setCookie: string): string {
  return setCookie.split(";")[0]
}

function pageRequest(path: string, cookies: string[] = [], headers: Record<string, string> = {}) {
  return new Request(`https://app${path}`, {
    headers: {
      host: "manaaki.micsco.nz",
      "x-forwarded-proto": "https",
      accept: "text/html,application/xhtml+xml",
      ...(cookies.length ? { cookie: cookies.join("; ") } : {}),
      ...headers,
    },
  })
}

const knownCookie = () => cookiePair(buildKnownDeviceSetCookie("mike@example.com", true))
const sessionCookie = () => cookiePair(buildSessionSetCookie("jwt", true))
const markerCookie = () => cookiePair(buildSilentAttemptMarkerCookie(true))

describe("known-device cookie", () => {
  it("round-trips the email through a sealed, long-lived, HttpOnly host cookie", () => {
    const setCookie = buildKnownDeviceSetCookie("mike@example.com", true)
    expect(setCookie).toMatch(/^__Host-manaaki_known=/)
    expect(setCookie).not.toContain("mike@example.com")
    expect(setCookie).toContain("HttpOnly")
    expect(setCookie).toContain("Secure")
    expect(setCookie).toContain("SameSite=Lax")
    expect(setCookie).toContain(`Max-Age=${365 * 24 * 60 * 60}`)
    expect(readKnownDevice(pageRequest("/recipes", [cookiePair(setCookie)]))).toEqual({
      email: "mike@example.com",
    })
  })

  it("reads nothing when the cookie is absent or tampered", () => {
    expect(readKnownDevice(pageRequest("/recipes"))).toBeNull()
    expect(readKnownDevice(pageRequest("/recipes", ["__Host-manaaki_known=garbage"]))).toBeNull()
  })

  it("clears under the same name with Max-Age=0", () => {
    const cleared = buildClearKnownDeviceCookie(true)
    expect(cleared).toMatch(/^__Host-manaaki_known=;/)
    expect(cleared).toContain("Max-Age=0")
  })
})

describe("silent attempt marker", () => {
  it("is a short-lived HttpOnly host cookie", () => {
    const marker = buildSilentAttemptMarkerCookie(true)
    expect(marker).toMatch(/^__Host-manaaki_silent=/)
    expect(marker).toContain("Max-Age=600")
    expect(marker).toContain("HttpOnly")
    expect(hasRecentSilentAttempt(pageRequest("/recipes", [cookiePair(marker)]))).toBe(true)
    expect(hasRecentSilentAttempt(pageRequest("/recipes"))).toBe(false)
  })
})

describe("safeReturnPath", () => {
  it("keeps same-origin absolute paths and falls back to /recipes otherwise", () => {
    expect(safeReturnPath("/plan?week=2")).toBe("/plan?week=2")
    expect(safeReturnPath("https://evil.example/x")).toBe("/recipes")
    expect(safeReturnPath("//evil.example/x")).toBe("/recipes")
    expect(safeReturnPath("/\\evil.example")).toBe("/recipes")
    expect(safeReturnPath(null)).toBe("/recipes")
    expect(safeReturnPath("")).toBe("/recipes")
  })
})

describe("silentLoginRedirect", () => {
  it("sends a known device with no session to a silent login that returns to the same page", () => {
    expect(silentLoginRedirect(pageRequest("/plan?week=2", [knownCookie()]))).toBe(
      "/api/auth/oauth?silent=1&returnTo=%2Fplan%3Fweek%3D2"
    )
  })

  it("does nothing for a first-time visitor with no known-device cookie", () => {
    expect(silentLoginRedirect(pageRequest("/recipes"))).toBeNull()
  })

  it("does nothing when a session cookie is already present", () => {
    expect(
      silentLoginRedirect(pageRequest("/recipes", [knownCookie(), sessionCookie()]))
    ).toBeNull()
  })

  it("does nothing while a recent silent attempt marker is present", () => {
    expect(silentLoginRedirect(pageRequest("/recipes", [knownCookie(), markerCookie()]))).toBeNull()
  })

  it("ignores API, login and asset requests", () => {
    expect(silentLoginRedirect(pageRequest("/api/recipes", [knownCookie()]))).toBeNull()
    expect(silentLoginRedirect(pageRequest("/login", [knownCookie()]))).toBeNull()
    expect(silentLoginRedirect(pageRequest("/manifest.webmanifest", [knownCookie()]))).toBeNull()
    expect(silentLoginRedirect(pageRequest("/favicon.ico", [knownCookie()]))).toBeNull()
  })

  it("ignores non-GET and non-HTML requests", () => {
    expect(
      silentLoginRedirect(
        new Request("https://app/recipes", {
          method: "POST",
          headers: { accept: "text/html", cookie: knownCookie(), "x-forwarded-proto": "https" },
        })
      )
    ).toBeNull()
    expect(
      silentLoginRedirect(pageRequest("/recipes", [knownCookie()], { accept: "application/json" }))
    ).toBeNull()
  })
})

describe("handleSilentLoginRequest", () => {
  it("returns a no-store 302 for router page requests that qualify", () => {
    const res = handleSilentLoginRequest(pageRequest("/recipes", [knownCookie()]), "router")
    expect(res?.status).toBe(302)
    expect(res?.headers.get("location")).toBe("/api/auth/oauth?silent=1&returnTo=%2Frecipes")
    expect(res?.headers.get("cache-control")).toBe("no-store")
  })

  it("never intercepts server function calls", () => {
    expect(
      handleSilentLoginRequest(pageRequest("/recipes", [knownCookie()]), "serverFn")
    ).toBeNull()
  })

  it("returns null when nothing qualifies so the request continues", () => {
    expect(handleSilentLoginRequest(pageRequest("/recipes"), "router")).toBeNull()
  })
})
