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
