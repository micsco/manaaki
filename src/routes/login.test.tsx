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
})
