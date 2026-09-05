import { describe, expect, it } from "vitest"

import { navigationDestination, parsePlanDate } from "./navigation"

describe("navigationDestination", () => {
  it("restores plan dates and recipe filters", () => {
    expect(navigationDestination("/plan?date=2026-10-12")).toEqual({
      to: "/plan",
      search: { date: "2026-10-12" },
    })
    expect(navigationDestination("/recipes?q=soup&protein=chicken,beef")).toEqual({
      to: "/recipes",
      search: { q: "soup", protein: "chicken,beef" },
    })
  })
  it.each([
    "https://other.example/plan",
    "//other.example/recipes?q=private",
    "/api/auth/logout",
    "javascript:alert(1)",
    "http://[",
  ])("falls back for an invalid destination: %s", href => {
    expect(navigationDestination(href)).toEqual({ to: "/recipes", search: {} })
  })
})

describe("parsePlanDate", () => {
  it.each(["2026-09-06", "2028-02-29"])("accepts real dates: %s", date =>
    expect(parsePlanDate(date)).toBe(date)
  )
  it.each(["2026-02-30", "tomorrow", "2026-13-01", "2026-9-1", "", "2026-02-29"])(
    "rejects invalid dates: %s",
    date => expect(parsePlanDate(date)).toBeNull()
  )
})
