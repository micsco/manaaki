import { QueryClient } from "@tanstack/react-query"
import { beforeEach, expect, it, vi } from "vitest"

import {
  getAllApiHouseholdsMealplansGet,
  getAllApiRecipesTimelineEventsGet,
} from "../api/generated/sdk.gen"
import { recipeDiscoveryQueryOptions } from "./useRecipeDiscovery"

vi.mock("../api/generated/sdk.gen", () => ({
  getAllApiHouseholdsMealplansGet: vi.fn(),
  getAllApiRecipesTimelineEventsGet: vi.fn(),
}))
beforeEach(() => vi.clearAllMocks())

it("loads every history and plan page, scopes the cache and reuses fresh data", async () => {
  vi.mocked(getAllApiRecipesTimelineEventsGet)
    .mockResolvedValueOnce({
      data: {
        items: [
          { id: "one", householdId: "home" },
          { id: "private", householdId: "other" },
        ],
        total_pages: 2,
      },
    } as never)
    .mockResolvedValueOnce({
      data: { items: [{ id: "two", householdId: "home" }], total_pages: 2 },
    } as never)
  vi.mocked(getAllApiHouseholdsMealplansGet)
    .mockResolvedValueOnce({
      data: { items: [{ recipeId: "one", date: "2026-09-26" }], total_pages: 2 },
    } as never)
    .mockResolvedValueOnce({
      data: {
        items: [
          { recipeId: "two", date: "2026-10-09" },
          { recipeId: "past", date: "2026-09-25" },
        ],
        total_pages: 2,
      },
    } as never)
  const client = new QueryClient()
  const options = recipeDiscoveryQueryOptions("user", "home", "2026-09-26")
  const result = await client.fetchQuery(options)
  expect(result.events.map(event => event.id)).toEqual(["one", "two"])
  expect(result.plannedIds).toEqual(["one", "two"])
  expect(getAllApiRecipesTimelineEventsGet).toHaveBeenCalledWith(
    expect.objectContaining({
      query: expect.objectContaining({ page: 2 }),
    })
  )
  for (const [request] of vi.mocked(getAllApiRecipesTimelineEventsGet).mock.calls) {
    expect(request?.query).not.toHaveProperty("queryFilter")
  }
  expect(getAllApiHouseholdsMealplansGet).toHaveBeenCalledWith(
    expect.objectContaining({
      query: expect.objectContaining({ page: 2, start_date: "2026-09-26", end_date: "2026-10-09" }),
    })
  )
  await client.fetchQuery(options)
  expect(getAllApiRecipesTimelineEventsGet).toHaveBeenCalledTimes(2)
  expect(options.queryKey).not.toEqual(
    recipeDiscoveryQueryOptions("other", "home", "2026-09-26").queryKey
  )
  expect(options.queryKey).not.toEqual(
    recipeDiscoveryQueryOptions("user", "other", "2026-09-26").queryKey
  )
  client.clear()
})

it("does not publish partial history when a later page fails", async () => {
  vi.mocked(getAllApiRecipesTimelineEventsGet)
    .mockResolvedValueOnce({ data: { items: [], total_pages: 2 } } as never)
    .mockResolvedValueOnce({ data: undefined } as never)
  vi.mocked(getAllApiHouseholdsMealplansGet).mockResolvedValue({ data: { items: [] } } as never)
  const client = new QueryClient()
  await expect(
    client.fetchQuery({
      ...recipeDiscoveryQueryOptions("user", "home", "2026-09-26"),
      retry: false,
    })
  ).rejects.toThrow("Could not load cooking history")
  client.clear()
})
