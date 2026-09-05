import { describe, expect, it } from "vitest"

import { loginCompletionHref } from "./loginReturn"

describe("loginCompletionHref", () => {
  it("forwards a successful provider return (code + state) to the completion route", () => {
    expect(loginCompletionHref({ code: "abc", state: "xyz" })).toBe(
      "/api/auth/complete?code=abc&state=xyz"
    )
  })

  it("forwards a provider refusal (error + state) so silent attempts can end quietly", () => {
    expect(loginCompletionHref({ error: "login_required", state: "xyz" })).toBe(
      "/api/auth/complete?error=login_required&state=xyz"
    )
  })

  it("returns null for a plain visit or manaaki's own error state", () => {
    expect(loginCompletionHref({})).toBeNull()
    expect(loginCompletionHref({ error: "oauth" })).toBeNull()
    expect(loginCompletionHref({ code: "abc" })).toBeNull()
  })

  it("encodes values", () => {
    expect(loginCompletionHref({ code: "a b&c", state: "s/t" })).toBe(
      "/api/auth/complete?code=a%20b%26c&state=s%2Ft"
    )
  })
})
