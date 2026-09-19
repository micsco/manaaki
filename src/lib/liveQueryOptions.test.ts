import { focusManager, onlineManager, QueryClient, QueryObserver } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { mealPlanQueryOptions } from "../hooks/useMealPlan"
import { recipeListQueryOptions } from "../hooks/useRecipeList"
import {
  currentListQueryOptions,
  shoppingHistoryQueryOptions,
  shoppingListDetailQueryOptions,
} from "../hooks/useShoppingList"
import { liveQueryOptions, recipeListRefreshOptions } from "./liveQueryOptions"

beforeEach(() => {
  vi.useFakeTimers()
  focusManager.setFocused(true)
  onlineManager.setOnline(true)
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true)
})
afterEach(() => {
  vi.useRealTimers()
  focusManager.setFocused(undefined)
  onlineManager.setOnline(true)
})

describe.each([
  ["meal plan", mealPlanQueryOptions("2026-09-19", "2026-09-25"), liveQueryOptions, 60_000],
  ["current shopping list", currentListQueryOptions, liveQueryOptions, 60_000],
  ["shopping details", shoppingListDetailQueryOptions("list"), liveQueryOptions, 60_000],
  ["shopping history", shoppingHistoryQueryOptions(1), liveQueryOptions, 60_000],
  ["recipe list", recipeListQueryOptions, recipeListRefreshOptions, 30 * 60_000],
])("%s freshness", (_name, options, policy, interval) => {
  it("polls while visible, skips background/offline polling, and refreshes on resume/reconnect", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { networkMode: "always", retry: false } },
    })
    client.mount()
    const queryFn = vi.fn().mockResolvedValue("latest")
    expect(options).toMatchObject(policy)
    const observer = new QueryObserver(client, {
      ...policy,
      queryKey: ["test"],
      queryFn,
    })
    const unsubscribe = observer.subscribe(() => {})
    await vi.advanceTimersByTimeAsync(0)
    expect(queryFn).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(interval)
    expect(queryFn).toHaveBeenCalledTimes(2)
    focusManager.setFocused(false)
    await vi.advanceTimersByTimeAsync(2 * interval)
    expect(queryFn).toHaveBeenCalledTimes(2)
    focusManager.setFocused(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(queryFn).toHaveBeenCalledTimes(3)
    onlineManager.setOnline(false)
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
    await vi.advanceTimersByTimeAsync(2 * interval)
    expect(queryFn).toHaveBeenCalledTimes(4)
    await vi.advanceTimersByTimeAsync(2 * interval)
    expect(queryFn).toHaveBeenCalledTimes(4)
    onlineManager.setOnline(true)
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(queryFn).toHaveBeenCalledTimes(5)
    unsubscribe()
    await vi.advanceTimersByTimeAsync(2 * interval)
    expect(queryFn).toHaveBeenCalledTimes(5)
    client.unmount()
    client.clear()
  })
})

it("shows stale cached data immediately while a fresh copy loads in the background", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(["mealplan"], "Cached plan", { updatedAt: Date.now() - 60_000 })
  let finish!: (value: string) => void
  const observer = new QueryObserver(client, {
    ...liveQueryOptions,
    queryKey: ["mealplan"],
    queryFn: () =>
      new Promise<string>(resolve => {
        finish = resolve
      }),
  })
  const unsubscribe = observer.subscribe(() => {})
  expect(observer.getCurrentResult()).toMatchObject({
    data: "Cached plan",
    isPending: false,
    isFetching: true,
  })
  finish("Updated plan")
  await vi.advanceTimersByTimeAsync(0)
  expect(observer.getCurrentResult()).toMatchObject({ data: "Updated plan", isFetching: false })
  unsubscribe()
  client.clear()
})

it("refreshes the recipe list on focus even inside its 30-minute freshness window", async () => {
  const client = new QueryClient()
  client.mount()
  client.setQueryData(["recipes"], "Cached recipes")
  const queryFn = vi.fn().mockResolvedValue("Updated recipes")
  const observer = new QueryObserver(client, {
    ...recipeListRefreshOptions,
    queryKey: ["recipes"],
    queryFn,
  })
  const unsubscribe = observer.subscribe(() => {})
  expect(queryFn).not.toHaveBeenCalled()
  focusManager.setFocused(false)
  await vi.advanceTimersByTimeAsync(1000)
  focusManager.setFocused(true)
  await vi.advanceTimersByTimeAsync(0)
  expect(queryFn).toHaveBeenCalledTimes(1)
  expect(observer.getCurrentResult().data).toBe("Updated recipes")
  unsubscribe()
  client.unmount()
  client.clear()
})
