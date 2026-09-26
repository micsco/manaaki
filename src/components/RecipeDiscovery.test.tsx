import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, expect, it, vi } from "vitest"

import {
  getAllApiHouseholdsMealplansGet,
  getAllApiRecipesTimelineEventsGet,
} from "../api/generated/sdk.gen"
import type { RecipeTimelineEventOut } from "../api/generated/types.gen"
import { toIsoDateString } from "../hooks/useMealPlan"
import { recipeDiscoveryQueryOptions } from "../hooks/useRecipeDiscovery"
import { render, screen, waitFor, within } from "../test/render"
import { RecipeDiscovery } from "./RecipeDiscovery"

vi.mock("../api/generated/sdk.gen", () => ({
  getAllApiHouseholdsMealplansGet: vi.fn(),
  getAllApiRecipesTimelineEventsGet: vi.fn(),
}))
vi.mock("@tanstack/react-router", async importOriginal => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))
const recipes = ["Soup", "Pasta"].map((name, i) => ({
  id: `00000000-0000-4000-8000-00000000000${i + 1}`,
  slug: name.toLowerCase(),
  name,
}))
function events(id: string, count = 2): RecipeTimelineEventOut[] {
  return Array.from({ length: count }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - i - 1)
    return {
      id: `${id}-${i}`,
      recipeId: recipes.find(recipe => recipe.name === id)!.id,
      householdId: "home",
      groupId: "group",
      userId: "user",
      eventType: "info",
      subject: "Mike made this for dinner",
      timestamp: date.toISOString(),
      createdAt: "",
      updatedAt: "",
    }
  })
}
const props = { userId: "user", householdId: "home", recipes, recipesReady: true, hidden: false }
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAllApiHouseholdsMealplansGet).mockResolvedValue({ data: { items: [] } } as never)
})

it("keeps visible order and focused recipe stable through background updates and filtering", async () => {
  const client = new QueryClient()
  const options = recipeDiscoveryQueryOptions("user", "home", toIsoDateString(new Date()))
  client.setQueryData(options.queryKey, {
    events: [...events("Soup", 3), ...events("Pasta")],
    plannedIds: [recipes[0].id],
  })
  const view = (hidden = false) => (
    <QueryClientProvider client={client}>
      <RecipeDiscovery {...props} hidden={hidden} />
    </QueryClientProvider>
  )
  const { rerender } = render(view())
  const list = screen.getByRole("list", { name: "Recently popular" })
  expect(
    within(list)
      .getAllByRole("link")
      .map(link => link.textContent)
  ).toEqual(["Soup", "Pasta"])
  expect(screen.getByText("On your plan in the next two weeks")).toBeInTheDocument()
  const user = userEvent.setup()
  await user.tab()
  expect(screen.getByRole("link", { name: "Soup" })).toHaveFocus()
  vi.mocked(getAllApiRecipesTimelineEventsGet).mockResolvedValue({
    data: { items: events("Pasta", 5) },
  } as never)
  await client.fetchQuery({ ...options, staleTime: 0 })
  await waitFor(() => expect(client.isFetching()).toBe(0))
  expect(
    within(list)
      .getAllByRole("link")
      .map(link => link.textContent)
  ).toEqual(["Soup", "Pasta"])
  expect(screen.getByRole("link", { name: "Soup" })).toHaveFocus()
  rerender(view(true))
  expect(screen.queryByRole("list", { name: "Recently popular" })).not.toBeInTheDocument()
  rerender(view())
  expect(
    within(list)
      .getAllByRole("link")
      .map(link => link.textContent)
  ).toEqual(["Soup", "Pasta"])
  client.clear()
})

it("waits for the recipe catalogue before settling its snapshot", async () => {
  vi.mocked(getAllApiRecipesTimelineEventsGet).mockResolvedValue({
    data: { items: events("Soup") },
  } as never)
  const client = new QueryClient()
  const view = (ready: boolean) => (
    <QueryClientProvider client={client}>
      <RecipeDiscovery {...props} recipesReady={ready} recipes={ready ? recipes : []} />
    </QueryClientProvider>
  )
  const { rerender } = render(view(false))
  expect(screen.getByRole("status", { name: "Loading cooking suggestions" })).toBeInTheDocument()
  await waitFor(() => expect(client.isFetching()).toBe(0))
  rerender(view(true))
  expect(await screen.findByRole("link", { name: "Soup" })).toHaveAttribute(
    "href",
    "/recipes/AAAAAAAAQACAAAAAAAAAAQ/soup"
  )
  expect(screen.queryByRole("status")).not.toBeInTheDocument()
  client.clear()
})

it("hides empty rows for a household without cooking history", async () => {
  vi.mocked(getAllApiRecipesTimelineEventsGet).mockResolvedValue({ data: { items: [] } } as never)
  render(<RecipeDiscovery {...props} />)
  await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument())
  expect(screen.queryByRole("heading")).not.toBeInTheDocument()
})

it("offers a retry on history failure without claiming there is no history", async () => {
  vi.mocked(getAllApiRecipesTimelineEventsGet).mockResolvedValue({ data: undefined } as never)
  render(<RecipeDiscovery {...props} />)
  const retry = await screen.findByRole("button", { name: "Retry suggestions" }, { timeout: 3000 })
  vi.mocked(getAllApiRecipesTimelineEventsGet).mockResolvedValue({
    data: { items: events("Soup") },
  } as never)
  await userEvent.setup().click(retry)
  expect(await screen.findByRole("link", { name: "Soup" })).toBeInTheDocument()
})
