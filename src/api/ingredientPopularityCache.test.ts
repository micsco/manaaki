import { QueryClient } from "@tanstack/react-query"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import { loadIngredientCatalog } from "./ingredientCatalog"
import { loadFoodRecipeCount } from "./ingredientPopularity"
import {
  ingredientPopularitySnapshot,
  prefetchFoodPopularity,
  prefetchIngredientPopularity,
} from "./ingredientPopularityCache"

vi.mock("./ingredientPopularity", () => ({ loadFoodRecipeCount: vi.fn() }))
vi.mock("./ingredientCatalog", () => ({ loadIngredientCatalog: vi.fn() }))
const key = "manaaki:ingredient-popularity:v1:user"

beforeEach(() => {
  const storage = new Map<string, string>()
  vi.stubGlobal("localStorage", {
    getItem: (name: string) => storage.get(name) ?? null,
    setItem: (name: string, value: string) => storage.set(name, value),
  })
  vi.mocked(loadFoodRecipeCount).mockResolvedValue(7)
  vi.mocked(loadIngredientCatalog).mockResolvedValue({
    food: [
      { id: "lime", name: "lime" },
      { id: "juice", name: "lime juice" },
      { id: "apple", name: "apple" },
    ],
    unit: [],
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it("prefetches only matching foods and deduplicates repeated parsed names", async () => {
  await prefetchIngredientPopularity(new QueryClient(), "user", ["LIME", " lime ", "l", ""])
  expect(loadFoodRecipeCount).toHaveBeenCalledTimes(2)
  expect(loadFoodRecipeCount).toHaveBeenCalledWith("lime", expect.any(AbortSignal))
  expect(loadFoodRecipeCount).toHaveBeenCalledWith("juice", expect.any(AbortSignal))
})

it("restores fresh counts across reloads without another request and isolates accounts", async () => {
  await prefetchFoodPopularity(new QueryClient(), "user", ["lime"])
  const reloaded = new QueryClient()
  expect(ingredientPopularitySnapshot(reloaded, "user")).toEqual({ lime: 7 })
  expect(ingredientPopularitySnapshot(reloaded, "another-user")).toEqual({})
  await prefetchFoodPopularity(reloaded, "user", ["lime"])
  expect(loadFoodRecipeCount).toHaveBeenCalledTimes(1)
})

it("uses stale counts immediately and refreshes them without changing an existing snapshot", async () => {
  localStorage.setItem(
    key,
    JSON.stringify({ lime: { count: 2, updatedAt: Date.now() - 6 * 60 * 1000 } })
  )
  const client = new QueryClient()
  const snapshot = ingredientPopularitySnapshot(client, "user")
  expect(snapshot).toEqual({ lime: 2 })
  await prefetchFoodPopularity(client, "user", ["lime"])
  expect(snapshot).toEqual({ lime: 2 })
  expect(ingredientPopularitySnapshot(client, "user")).toEqual({ lime: 7 })
})

it("ignores expired, invalid and corrupt persisted entries", () => {
  localStorage.setItem(
    key,
    JSON.stringify({
      expired: { count: 3, updatedAt: Date.now() - 25 * 60 * 60 * 1000 },
      invalid: { count: -1, updatedAt: Date.now() },
      future: { count: 4, updatedAt: Date.now() + 10000 },
      valid: { count: 0, updatedAt: Date.now() },
    })
  )
  expect(ingredientPopularitySnapshot(new QueryClient(), "user")).toEqual({ valid: 0 })
  localStorage.setItem(key, "not json")
  expect(ingredientPopularitySnapshot(new QueryClient(), "user")).toEqual({})
})

it("keeps count requests globally limited to four and shares overlapping requests", async () => {
  let active = 0
  let maximum = 0
  const pending: (() => void)[] = []
  vi.mocked(loadFoodRecipeCount).mockImplementation(
    () =>
      new Promise(resolve => {
        active++
        maximum = Math.max(maximum, active)
        pending.push(() => {
          active--
          resolve(1)
        })
      })
  )
  const client = new QueryClient()
  const first = prefetchFoodPopularity(client, "user", ["1", "2", "3", "4", "5", "6"])
  const second = prefetchFoodPopularity(client, "user", ["4", "5", "6", "7", "8"])
  await vi.waitFor(() => expect(pending).toHaveLength(4))
  for (let index = 0; index < 8; index++) {
    await vi.waitFor(() => expect(pending.length).toBeGreaterThan(index))
    pending[index]()
  }
  await Promise.all([first, second])
  expect(maximum).toBe(4)
  expect(loadFoodRecipeCount).toHaveBeenCalledTimes(8)
})

it("tolerates storage and lookup failures without losing an older count", async () => {
  const client = new QueryClient()
  client.setQueryData(["ingredientRecipeCount", "user", "lime"], 3, {
    updatedAt: Date.now() - 6 * 60 * 1000,
  })
  vi.spyOn(localStorage, "getItem").mockImplementation(() => {
    throw new Error("Blocked")
  })
  vi.mocked(loadFoodRecipeCount).mockRejectedValue(new Error("Offline"))
  await prefetchFoodPopularity(client, "user", ["lime"])
  expect(ingredientPopularitySnapshot(client, "user")).toEqual({ lime: 3 })
  vi.mocked(loadFoodRecipeCount).mockResolvedValue(8)
  vi.spyOn(localStorage, "setItem").mockImplementation(() => {
    throw new Error("Full")
  })
  await prefetchFoodPopularity(client, "user", ["lime"])
  expect(ingredientPopularitySnapshot(client, "user")).toEqual({ lime: 8 })
})

it("skips cancelled requests before they reach Mealie", async () => {
  const controller = new AbortController()
  controller.abort()
  await prefetchFoodPopularity(new QueryClient(), "user", ["lime"], controller.signal)
  expect(loadFoodRecipeCount).not.toHaveBeenCalled()
})
