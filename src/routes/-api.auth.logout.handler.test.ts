import { describe, expect, it } from "vitest"

import { logoutHandler } from "./api.auth.logout"

describe("logoutHandler", () => {
  it("clears both the session and the known-device cookie so the next visit stays anonymous", () => {
    const res = logoutHandler(
      new Request("https://app/api/auth/logout", {
        method: "POST",
        headers: { "x-forwarded-proto": "https" },
      })
    )
    expect(res.status).toBe(204)
    const cookies = res.headers.getSetCookie()
    expect(cookies.find(c => c.startsWith("__Host-manaaki_session="))).toContain("Max-Age=0")
    expect(cookies.find(c => c.startsWith("__Host-manaaki_known="))).toContain("Max-Age=0")
  })
})
