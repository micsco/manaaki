// src/hooks/useShoppingMutations.test.ts
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import * as sdk from "../api/generated/sdk.gen"
import { shoppingListDetailQueryOptions } from "./useShoppingList"
import { useToggleItem } from "./useShoppingMutations"

vi.mock("../api/generated/sdk.gen", () => ({
  updateOneApiHouseholdsShoppingItemsItemIdPut: vi.fn(),
  createManyApiHouseholdsShoppingItemsCreateBulkPost: vi.fn(),
  deleteOneApiHouseholdsShoppingItemsItemIdDelete: vi.fn(),
}))

function setup() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  qc.setQueryData(shoppingListDetailQueryOptions("l1").queryKey, {
    id: "l1",
    listItems: [
      {
        id: "i1",
        shoppingListId: "l1",
        groupId: "g1",
        householdId: "h1",
        checked: false,
        display: "Eggs",
      },
    ],
    labelSettings: [],
  } as never)
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
  return { qc, wrapper }
}

describe("useToggleItem", () => {
  beforeEach(() => vi.clearAllMocks())

  it("optimistically flips checked and sends a mapped update", async () => {
    vi.mocked(sdk.updateOneApiHouseholdsShoppingItemsItemIdPut).mockResolvedValue({
      data: { updatedItems: [{ id: "i1", shoppingListId: "l1", checked: true, display: "Eggs" }] },
    } as never)
    const { qc, wrapper } = setup()
    const { result } = renderHook(() => useToggleItem("l1"), { wrapper })

    act(() =>
      result.current.toggle({
        id: "i1",
        shoppingListId: "l1",
        checked: false,
        display: "Eggs",
      } as never)
    )

    const body = vi.mocked(sdk.updateOneApiHouseholdsShoppingItemsItemIdPut).mock
      .calls[0][0] as never
    expect((body as { path: { item_id: string } }).path.item_id).toBe("i1")
    expect((body as { body: { shoppingListId: string; checked: boolean } }).body).toMatchObject({
      shoppingListId: "l1",
      checked: true,
    })

    await waitFor(() => {
      const list = qc.getQueryData(shoppingListDetailQueryOptions("l1").queryKey) as {
        listItems: { checked: boolean }[]
      }
      expect(list.listItems[0].checked).toBe(true)
    })
  })

  it("serializes: a second toggle while the first is pending is ignored", async () => {
    let resolve!: (v: unknown) => void
    vi.mocked(sdk.updateOneApiHouseholdsShoppingItemsItemIdPut).mockReturnValue(
      new Promise(r => {
        resolve = r
      }) as never
    )
    const { wrapper } = setup()
    const { result } = renderHook(() => useToggleItem("l1"), { wrapper })
    const item = { id: "i1", shoppingListId: "l1", checked: false, display: "Eggs" } as never

    act(() => result.current.toggle(item))
    act(() => result.current.toggle(item)) // ignored — i1 pending
    expect(vi.mocked(sdk.updateOneApiHouseholdsShoppingItemsItemIdPut)).toHaveBeenCalledTimes(1)
    act(() => resolve({ data: { updatedItems: [] } }))
  })
})
