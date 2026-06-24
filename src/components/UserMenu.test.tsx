import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { UserMenu } from "./UserMenu"

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe("UserMenu", () => {
  it("shows Sign in when anonymous", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ user: null, isAnonymous: true }), { status: 200 })
    )
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
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ user: { username: "a" }, isAnonymous: false }), { status: 200 })
    )
    render(<UserMenu />, { wrapper })
    await waitFor(() =>
      expect(screen.getByRole("link", { name: /meal plan/i })).toBeInTheDocument()
    )
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument()
    vi.restoreAllMocks()
  })
})
