import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import * as auth from "../api/auth"
import { UserMenu } from "./UserMenu"

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe("UserMenu", () => {
  it("shows Sign in when anonymous", async () => {
    vi.spyOn(auth, "fetchCurrentUser").mockResolvedValue({ user: null, isAnonymous: true })
    render(<UserMenu />, { wrapper })
    await waitFor(() =>
      expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
        "href",
        "/api/auth/oauth"
      )
    )
    vi.restoreAllMocks()
  })

  it("shows Meal Plan + Sign out when authed", async () => {
    vi.spyOn(auth, "fetchCurrentUser").mockResolvedValue({
      user: { username: "a" } as never,
      isAnonymous: false,
    })
    render(<UserMenu />, { wrapper })
    await waitFor(() =>
      expect(screen.getByRole("link", { name: /meal plan/i })).toBeInTheDocument()
    )
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /shopping/i })).toHaveAttribute("href", "/shopping")
    vi.restoreAllMocks()
  })
})
