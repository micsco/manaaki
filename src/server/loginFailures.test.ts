import { afterEach, describe, expect, it, vi } from "vitest"

import { reportLoginFailure } from "./loginFailures"

afterEach(() => vi.restoreAllMocks())

describe("reportLoginFailure", () => {
  it("logs the stage and the error without anything else from the request", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})

    reportLoginFailure("complete", new Error("OIDC token exchange failed: 401"))

    expect(log).toHaveBeenCalledWith(
      "Sign-in failed at complete: Error: OIDC token exchange failed: 401"
    )
  })

  it("logs a provider's error code", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})

    reportLoginFailure("provider", "access_denied")

    expect(log).toHaveBeenCalledWith("Sign-in failed at provider: access_denied")
  })

  it("does not repeat arbitrary text a visitor put in the callback URL", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})

    reportLoginFailure("provider", "<script>forged\nlog line")

    expect(log).toHaveBeenCalledWith("Sign-in failed at provider: unknown")
  })
})
