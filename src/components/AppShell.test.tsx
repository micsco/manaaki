import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, expect, it, vi } from "vitest"

import { NavigationProvider } from "../contexts/NavigationContext"
import { useCurrentUser } from "../hooks/useCurrentUser"
import { CookModeWrapper, render, screen, within } from "../test/render"
import { AppShell } from "./AppShell"
import { RecipeBackLink } from "./RecipeBackLink"

const route = vi.hoisted(() => ({
  pathname: "/plan",
  searchStr: "?date=2026-10-12",
  href: "/plan?date=2026-10-12",
}))
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => route,
  Link: ({ to, search, children, activeOptions: _activeOptions, activeProps, ...props }: any) => (
    <a
      href={to + (search && Object.keys(search).length ? `?${new URLSearchParams(search)}` : "")}
      {...(route.pathname.startsWith(to) ? activeProps : {})}
      {...props}
    >
      {children}
    </a>
  ),
}))
vi.mock("../hooks/useCurrentUser", () => ({ useCurrentUser: vi.fn() }))
vi.mock("./AboutModal", () => ({
  AboutModal: ({ open }: { open: boolean }) =>
    open ? <div role="dialog">About Manaaki</div> : null,
}))
vi.mock("../manaaki.svg?react", () => ({ default: () => null }))

beforeEach(() => {
  Object.assign(route, {
    pathname: "/plan",
    searchStr: "?date=2026-10-12",
    href: "/plan?date=2026-10-12",
  })
  vi.mocked(useCurrentUser).mockReturnValue({
    user: { fullName: "Mike Scott" } as never,
    isAnonymous: false,
  })
})

it("provides the same labelled destinations and account on regular pages", () => {
  render(
    <AppShell>
      <h1>Meals coming up</h1>
    </AppShell>
  )
  for (const nav of screen.getAllByRole("navigation", { name: "Main navigation" })) {
    expect(
      within(nav)
        .getAllByRole("link")
        .map(link => link.textContent)
    ).toEqual(["Plan", "Recipes", "Shopping"])
    expect(within(nav).getByRole("link", { name: "Plan" })).toHaveAttribute("aria-current", "page")
  }
  expect(screen.getByRole("button", { name: /user menu for mike scott/i })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute(
    "href",
    "#app-content"
  )
})

it.each([undefined, { user: null, isAnonymous: true }])(
  "does not expose private destinations before authentication: %s",
  current => {
    vi.mocked(useCurrentUser).mockReturnValue(current)
    render(
      <AppShell>
        <h1>Recipe</h1>
      </AppShell>
    )
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Plan" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Shopping" })).not.toBeInTheDocument()
  }
)

it("keeps a plain sign-in entry that returns to the requested recipe", () => {
  vi.mocked(useCurrentUser).mockReturnValue({ user: null, isAnonymous: true })
  route.href = "/recipes/abc/soup"
  render(
    <AppShell>
      <h1>Soup</h1>
    </AppShell>
  )
  expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/api/auth/oauth?returnTo=%2Frecipes%2Fabc%2Fsoup"
  )
})

it("hides the entire app shell for a direct Home Assistant cook link", () => {
  route.pathname = "/recipes/abc/soup"
  render(
    <AppShell>
      <h1>Cooking soup</h1>
    </AppShell>,
    { wrapper: ({ children }) => <CookModeWrapper cookMode>{children}</CookModeWrapper> }
  )
  expect(screen.getByRole("heading", { name: "Cooking soup" })).toBeInTheDocument()
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument()
  expect(screen.queryByRole("banner")).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: /user menu/i })).not.toBeInTheDocument()
})

it("keeps About in the account menu", async () => {
  const user = userEvent.setup()
  render(
    <AppShell>
      <p>Content</p>
    </AppShell>
  )
  await user.click(screen.getByRole("button", { name: /user menu/i }))
  await user.click(await screen.findByRole("menuitem", { name: "About Manaaki" }))
  expect(screen.getByRole("dialog")).toHaveTextContent("About Manaaki")
})

function NavigationHarness({ children }: { children: ReactNode }) {
  return (
    <NavigationProvider>
      <AppShell>{children}</AppShell>
    </NavigationProvider>
  )
}

it("returns from a recipe to the same plan date and restores navigation after remount", () => {
  const view = render(
    <NavigationHarness>
      <p>Plan</p>
    </NavigationHarness>
  )
  Object.assign(route, { pathname: "/recipes/abc/soup", searchStr: "", href: "/recipes/abc/soup" })
  view.rerender(
    <NavigationHarness>
      <RecipeBackLink />
    </NavigationHarness>
  )
  expect(screen.getByRole("link", { name: "Back to plan" })).toHaveAttribute(
    "href",
    "/plan?date=2026-10-12"
  )
  view.unmount()
  render(
    <NavigationHarness>
      <RecipeBackLink />
    </NavigationHarness>
  )
  expect(screen.getByRole("link", { name: "Back to plan" })).toHaveAttribute(
    "href",
    "/plan?date=2026-10-12"
  )
})

it("does not reveal a remembered private origin when signed out", () => {
  sessionStorage.setItem("navigation-origin", JSON.stringify("/shopping?list=private"))
  vi.mocked(useCurrentUser).mockReturnValue({ user: null, isAnonymous: true })
  Object.assign(route, { pathname: "/recipes/abc/soup", searchStr: "", href: "/recipes/abc/soup" })
  render(
    <NavigationHarness>
      <RecipeBackLink />
    </NavigationHarness>
  )
  expect(screen.getByRole("link", { name: "All recipes" })).toHaveAttribute("href", "/recipes")
  expect(screen.queryByRole("link", { name: "Back to shopping" })).not.toBeInTheDocument()
})
