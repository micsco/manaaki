import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import React from "react"
import { describe, expect, it, vi } from "vitest"

import * as sdk from "../api/generated/sdk.gen"
import { useCurrentShoppingList } from "./useShoppingList"

vi.mock("../api/generated/sdk.gen", () => ({
  getAllApiHouseholdsShoppingListsGet: vi.fn(),
  getOneApiHouseholdsShoppingListsItemIdGet: vi.fn(),
}))

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
}

describe("useCurrentShoppingList", () => {
  it("requests newest-first with perPage 1 and returns items[0]", async () => {
    vi.mocked(sdk.getAllApiHouseholdsShoppingListsGet).mockResolvedValue({
      data: { items: [{ id: "newest", name: "Shop" }] },
    } as never)
    const { result } = renderHook(() => useCurrentShoppingList(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current?.id).toBe("newest"))
    const arg = vi.mocked(sdk.getAllApiHouseholdsShoppingListsGet).mock.calls[0][0] as never
    expect((arg as { query: Record<string, unknown> }).query).toMatchObject({
      orderBy: "createdAt",
      orderDirection: "desc",
      perPage: 1,
    })
  })

  it("returns null when there are no lists", async () => {
    vi.mocked(sdk.getAllApiHouseholdsShoppingListsGet).mockResolvedValue({
      data: { items: [] },
    } as never)
    const { result } = renderHook(() => useCurrentShoppingList(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current).toBeNull())
  })

  it("does not fetch when enabled is false", () => {
    const { result } = renderHook(() => useCurrentShoppingList({ enabled: false }), {
      wrapper: wrapper(),
    })
    expect(result.current).toBeUndefined()
    expect(sdk.getAllApiHouseholdsShoppingListsGet).not.toHaveBeenCalled()
  })
})

it("preserves the current list when a refresh fails", async () => {
  vi.mocked(sdk.getAllApiHouseholdsShoppingListsGet).mockResolvedValue({
    data: { items: [{ id: "saved", name: "Shop" }] },
  } as never)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const { currentListQueryOptions, shoppingHistoryQueryOptions } = await import("./useShoppingList")
  await client.fetchQuery(currentListQueryOptions)
  await client.fetchQuery(shoppingHistoryQueryOptions(1))
  vi.mocked(sdk.getAllApiHouseholdsShoppingListsGet).mockResolvedValue({
    error: "Unavailable",
  } as never)
  await client.invalidateQueries()
  await expect(client.fetchQuery(currentListQueryOptions)).rejects.toThrow(
    "Failed to load shopping lists"
  )
  await expect(client.fetchQuery(shoppingHistoryQueryOptions(1))).rejects.toThrow(
    "Failed to load shopping history"
  )
  expect(client.getQueryData(currentListQueryOptions.queryKey)).toMatchObject({ id: "saved" })
  expect(client.getQueryData(shoppingHistoryQueryOptions(1).queryKey)).toEqual([
    { id: "saved", name: "Shop" },
  ])
  client.clear()
})
