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
  const origin = "https://manaaki.micsco.nz"
  const resolvedOrigin = (candidate: string) => new URL(safeReturnPath(candidate), origin).origin

  it("keeps same-origin absolute paths and falls back to /recipes otherwise", () => {
    expect(safeReturnPath("/plan?week=2")).toBe("/plan?week=2")
    expect(safeReturnPath("/shopping?list=abc&partial=true#items")).toBe(
      "/shopping?list=abc&partial=true#items"
    )
    expect(safeReturnPath("https://evil.example/x")).toBe("/recipes")
    expect(safeReturnPath("//evil.example/x")).toBe("/recipes")
    expect(safeReturnPath("/\\evil.example")).toBe("/recipes")
    expect(safeReturnPath("recipes")).toBe("/recipes")
    expect(safeReturnPath(null)).toBe("/recipes")
    expect(safeReturnPath("")).toBe("/recipes")
  })

  it.each([
    ["a tab before the second slash", "/\t/evil.example"],
    ["a tab before a backslash", "/\t\\evil.example"],
    ["a newline before the second slash", "/\n/evil.example"],
    ["a carriage return before the second slash", "/\r/evil.example"],
    ["a leading tab", "\t//evil.example"],
    ["a tab inside the scheme-relative slashes", "/\t/\t/evil.example"],
    ["a dot segment that collapses to a double slash", "/.//evil.example"],
    ["a parent segment that collapses to a double slash", "/..//evil.example"],
    ["a backslash after a dot segment", "/.\\/evil.example"],
    ["a backslash deeper in the path", "/recipes\\..\\..\\/evil.example"],
  ])("never leaves the site when the path has %s", (_description, candidate) => {
    expect(resolvedOrigin(candidate)).toBe(origin)
  })

  it("rejects control characters and backslashes outright instead of repairing them", () => {
    expect(safeReturnPath("/plan\t")).toBe("/recipes")
    expect(safeReturnPath("/plan\u0000")).toBe("/recipes")
    expect(safeReturnPath("/plan\u007f")).toBe("/recipes")
    expect(safeReturnPath("/plan\\week")).toBe("/recipes")
  })

  it("returns the normalised path, not the raw input", () => {
    expect(safeReturnPath("/recipes/../plan")).toBe("/plan")
    expect(safeReturnPath("/plan?note=a b")).toBe("/plan?note=a%20b")
  })

  it("keeps percent-encoded characters encoded", () => {
    expect(safeReturnPath("/%09/evil.example")).toBe("/%09/evil.example")
    expect(resolvedOrigin("/%2F%2Fevil.example")).toBe(origin)
  })

  it("never returns to an API endpoint", () => {
    expect(safeReturnPath("/api/auth/oauth?silent=1&returnTo=%2Fplan")).toBe("/recipes")
    expect(safeReturnPath("/api")).toBe("/recipes")
    expect(safeReturnPath("/recipes/../api/auth/logout")).toBe("/recipes")
    expect(safeReturnPath("/apiary")).toBe("/apiary")
  })

  it("rejects paths too long to fit in the login attempt cookie", () => {
    expect(safeReturnPath(`/plan?week=${"1".repeat(2048)}`)).toBe("/recipes")
    expect(safeReturnPath(`/plan?week=${"1".repeat(1000)}`)).toBe(`/plan?week=${"1".repeat(1000)}`)
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
