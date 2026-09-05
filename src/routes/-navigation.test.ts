import { beforeEach, expect, it, vi } from "vitest"

import { fetchCurrentUser } from "../api/auth"
import { Route as Home } from "./index"
import { Route as Plan } from "./plan"
import { Route as Shopping } from "./shopping"
vi.mock("../api/auth", () => ({ fetchCurrentUser: vi.fn() }))
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  redirect: (options: unknown) => options,
}))
vi.mock("../components/WeeklyMealPlan", () => ({ WeeklyMealPlan: () => null }))
beforeEach(() => vi.mocked(fetchCurrentUser).mockResolvedValue({ user: null, isAnonymous: true }))
it.each([
  [true, "/recipes"],
  [false, "/plan"],
])("opens the appropriate landing page for anonymous=%s", async (isAnonymous, to) => {
  vi.mocked(fetchCurrentUser).mockResolvedValue({ user: null, isAnonymous })
  await expect((Home.options.beforeLoad as any)()).rejects.toEqual({ to })
})
it.each([
  [Plan, "/plan?date=2026-10-12"],
  [Shopping, "/shopping?list=selected"],
])("preserves the full private destination through login", async (route, href) => {
  await expect((route.options.beforeLoad as any)({ location: { href } })).rejects.toEqual({
    href: `/api/auth/oauth?returnTo=${encodeURIComponent(href)}`,
  })
})
it("allows signed-in plan access", async () => {
  vi.mocked(fetchCurrentUser).mockResolvedValue({ user: null, isAnonymous: false })
  await expect(
    (Plan.options.beforeLoad as any)({ location: { href: "/plan" } })
  ).resolves.toBeUndefined()
})
