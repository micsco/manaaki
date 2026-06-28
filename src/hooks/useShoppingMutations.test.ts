// src/hooks/useShoppingMutations.test.ts
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import * as sdk from "../api/generated/sdk.gen"
import { shoppingListDetailQueryOptions } from "./useShoppingList"
import { buildShoppingList, useToggleItem } from "./useShoppingMutations"

vi.mock("../api/generated/sdk.gen", () => ({
  updateOneApiHouseholdsShoppingItemsItemIdPut: vi.fn(),
  createManyApiHouseholdsShoppingItemsCreateBulkPost: vi.fn(),
  deleteOneApiHouseholdsShoppingItemsItemIdDelete: vi.fn(),
  createOneApiHouseholdsShoppingListsPost: vi.fn(),
  addRecipeIngredientsToListApiHouseholdsShoppingListsItemIdRecipePost: vi.fn(),
  getOneApiHouseholdsShoppingListsItemIdGet: vi.fn(),
  deleteOneApiHouseholdsShoppingListsItemIdDelete: vi.fn(),
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

const sdk2 = sdk as unknown as Record<string, ReturnType<typeof vi.fn>>

describe("buildShoppingList", () => {
  beforeEach(() => vi.clearAllMocks())

  it("creates a list then bulk-adds recipes; returns the new list id", async () => {
    sdk2.createOneApiHouseholdsShoppingListsPost = vi
      .fn()
      .mockResolvedValue({ data: { id: "new1" } })
    sdk2.addRecipeIngredientsToListApiHouseholdsShoppingListsItemIdRecipePost = vi
      .fn()
      .mockResolvedValue({ data: {} })
    const res = await buildShoppingList({
      name: "Shop · X",
      selections: [{ recipeId: "r1", recipeIncrementQuantity: 1.5 }],
    })
    expect(res).toEqual({ listId: "new1", partial: false })
    expect(sdk2.createOneApiHouseholdsShoppingListsPost).toHaveBeenCalledWith({
      body: { name: "Shop · X" },
    })
    expect(
      sdk2.addRecipeIngredientsToListApiHouseholdsShoppingListsItemIdRecipePost
    ).toHaveBeenCalledWith({
      path: { item_id: "new1" },
      body: [{ recipeId: "r1", recipeIncrementQuantity: 1.5 }],
    })
  })

  it("on add failure with an empty list, deletes it (best-effort) and throws", async () => {
    sdk2.createOneApiHouseholdsShoppingListsPost = vi
      .fn()
      .mockResolvedValue({ data: { id: "new2" } })
    sdk2.addRecipeIngredientsToListApiHouseholdsShoppingListsItemIdRecipePost = vi
      .fn()
      .mockRejectedValue(new Error("boom"))
    sdk2.getOneApiHouseholdsShoppingListsItemIdGet = vi
      .fn()
      .mockResolvedValue({ data: { id: "new2", listItems: [] } })
    sdk2.deleteOneApiHouseholdsShoppingListsItemIdDelete = vi.fn().mockResolvedValue({ data: {} })
    await expect(
      buildShoppingList({
        name: "Shop · Y",
        selections: [{ recipeId: "r1", recipeIncrementQuantity: 1 }],
      })
    ).rejects.toThrow()
    expect(sdk2.deleteOneApiHouseholdsShoppingListsItemIdDelete).toHaveBeenCalledWith({
      path: { item_id: "new2" },
    })
  })

  it("on add failure with a non-empty list, keeps it and returns partial", async () => {
    sdk2.createOneApiHouseholdsShoppingListsPost = vi
      .fn()
      .mockResolvedValue({ data: { id: "new3" } })
    sdk2.addRecipeIngredientsToListApiHouseholdsShoppingListsItemIdRecipePost = vi
      .fn()
      .mockRejectedValue(new Error("partial"))
    sdk2.getOneApiHouseholdsShoppingListsItemIdGet = vi
      .fn()
      .mockResolvedValue({ data: { id: "new3", listItems: [{ id: "x" }] } })
    const res = await buildShoppingList({
      name: "Shop · Z",
      selections: [{ recipeId: "r1", recipeIncrementQuantity: 1 }],
    })
    expect(res).toEqual({ listId: "new3", partial: true })
  })
})
