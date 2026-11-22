import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { LoginPage } from "./login"

describe("LoginPage", () => {
  it("offers a Google sign-in link to the OIDC initiation route", () => {
    render(<LoginPage />)
    expect(screen.getByRole("link", { name: /sign in with google/i })).toHaveAttribute(
      "href",
      "/api/auth/oauth"
    )
  })

  it("says nothing went wrong on a normal visit", () => {
    render(<LoginPage />)
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("explains that the last sign-in failed", () => {
    render(<LoginPage failed />)
    expect(screen.getByRole("alert")).toHaveTextContent(/signing in didn't work/i)
  })
})
