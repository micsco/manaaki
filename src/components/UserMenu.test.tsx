import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import * as auth from "../api/auth"
import { UserMenu } from "./UserMenu"

vi.mock("@tanstack/react-router", async importOriginal => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>()
  return {
    ...actual,
    Link: ({ to, children, ...props }: any) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  }
})

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe("UserMenu", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("shows Sign in when anonymous", async () => {
    vi.spyOn(auth, "fetchCurrentUser").mockResolvedValue({
      user: null,
      isAnonymous: true,
    })
    render(<UserMenu />, { wrapper })
    await waitFor(() =>
      expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
        "href",
        "/api/auth/oauth?returnTo=%2Frecipes"
      )
    )
  })

  it("shows identity without mixing in application destinations", async () => {
    vi.spyOn(auth, "fetchCurrentUser").mockResolvedValue({
      user: { fullName: "Mike Scott", username: "micsco" } as never,
      isAnonymous: false,
    })

    render(<UserMenu />, { wrapper })

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /user menu for mike scott/i })).toBeInTheDocument()
    })

    expect(screen.queryByRole("link", { name: /^shopping$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /^meal plan$/i })).not.toBeInTheDocument()
    expect(screen.getByText("MS")).toBeInTheDocument()
  })

  it("opens dropdown menu with user identity and options on click", async () => {
    const user = userEvent.setup()
    const onOpenAbout = vi.fn()
    vi.spyOn(auth, "fetchCurrentUser").mockResolvedValue({
      user: { fullName: "Mike Scott", username: "micsco" } as never,
      isAnonymous: false,
    })

    render(<UserMenu onOpenAbout={onOpenAbout} />, { wrapper })

    const trigger = await screen.findByRole("button", {
      name: /user menu for mike scott/i,
    })
    await user.click(trigger)

    expect(await screen.findByText("@micsco")).toBeInTheDocument()
    expect(screen.queryByRole("menuitem", { name: /shopping list/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("menuitem", { name: /meal plan/i })).not.toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: /about manaaki/i })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: /sign out/i })).toBeInTheDocument()

    await user.click(screen.getByRole("menuitem", { name: /about manaaki/i }))
    expect(onOpenAbout).toHaveBeenCalledTimes(1)
  })

  it("calls logout endpoint when sign out is clicked in menu", async () => {
    const user = userEvent.setup()
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response())
    delete (window as any).location
    window.location = { assign: vi.fn() } as any

    vi.spyOn(auth, "fetchCurrentUser").mockResolvedValue({
      user: { username: "chef" } as never,
      isAnonymous: false,
    })

    render(<UserMenu />, { wrapper })

    const trigger = await screen.findByRole("button", {
      name: /user menu for chef/i,
    })
    await user.click(trigger)

    const signOutItem = await screen.findByRole("menuitem", { name: /sign out/i })
    await user.click(signOutItem)

    expect(fetchSpy).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" })
    expect(window.location.assign).toHaveBeenCalledWith("/recipes")
  })
})
