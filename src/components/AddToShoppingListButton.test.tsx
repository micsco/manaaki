// src/components/AddToShoppingListButton.test.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import * as sdk from "../api/generated/sdk.gen"
import * as currentUser from "../hooks/useCurrentUser"
import * as shoppingList from "../hooks/useShoppingList"
import * as mutations from "../hooks/useShoppingMutations"
import { toastManager } from "../lib/toastManager"
import { resetUpdateHoldsForTesting, updateBlockers } from "../pwa/updateHolds"
import { AddToShoppingListButton } from "./AddToShoppingListButton"

vi.mock("../api/generated/sdk.gen", () => ({
  addRecipeIngredientsToListApiHouseholdsShoppingListsItemIdRecipePost: vi
    .fn()
    .mockResolvedValue({ data: {} }),
  removeRecipeIngredientsFromListApiHouseholdsShoppingListsItemIdRecipeRecipeIdDeletePost: vi
    .fn()
    .mockResolvedValue({ data: {} }),
}))

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}
const recipe = { id: "r1", name: "Soup", recipeServings: 4 } as never

async function click(name = /add to shopping list/i) {
  const { default: userEvent } = await import("@testing-library/user-event")
  await userEvent.click(screen.getByRole("button", { name }))
}

describe("AddToShoppingListButton", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })
  afterEach(() => {
    resetUpdateHoldsForTesting()
  })

  it("hides shopping when anonymous", () => {
    vi.spyOn(currentUser, "useCurrentUser").mockReturnValue({ user: null, isAnonymous: true })
    const listSpy = vi.spyOn(shoppingList, "useCurrentShoppingList").mockReturnValue(null)
    render(<AddToShoppingListButton recipe={recipe} />, { wrapper: wrap() })
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    expect(listSpy).toHaveBeenCalledWith({ enabled: false })
  })

  it("appends to a recent (<48h) list and offers 'New list instead'", async () => {
    vi.spyOn(currentUser, "useCurrentUser").mockReturnValue({
      user: { id: "u" },
      isAnonymous: false,
    } as never)
    vi.spyOn(shoppingList, "useCurrentShoppingList").mockReturnValue({
      id: "l1",
      createdAt: new Date().toISOString(),
    } as never)
    const addToast = vi.spyOn(toastManager, "add").mockReturnValue("t1")
    render(<AddToShoppingListButton recipe={recipe} />, { wrapper: wrap() })
    await click()
    await waitFor(() =>
      expect(
        sdk.addRecipeIngredientsToListApiHouseholdsShoppingListsItemIdRecipePost
      ).toHaveBeenCalledWith({
        path: { item_id: "l1" },
        body: [{ recipeId: "r1", recipeIncrementQuantity: 1 }],
      })
    )
    expect(addToast.mock.calls[0][0].actionProps?.children).toMatch(/new list/i)
  })

  it("starts a new list when there is no current list", async () => {
    vi.spyOn(currentUser, "useCurrentUser").mockReturnValue({
      user: { id: "u" },
      isAnonymous: false,
    } as never)
    vi.spyOn(shoppingList, "useCurrentShoppingList").mockReturnValue(null)
    const build = vi
      .spyOn(mutations, "buildShoppingList")
      .mockResolvedValue({ listId: "new1", partial: false })
    const addToast = vi.spyOn(toastManager, "add").mockReturnValue("t2")
    render(<AddToShoppingListButton recipe={recipe} />, { wrapper: wrap() })
    await click()
    await waitFor(() => expect(build).toHaveBeenCalled())
    expect(addToast.mock.calls[0][0].title).toMatch(/new shopping list/i)
    expect(
      sdk.addRecipeIngredientsToListApiHouseholdsShoppingListsItemIdRecipePost
    ).not.toHaveBeenCalled()
  })

  it("holds automatic updates while adding", async () => {
    vi.spyOn(currentUser, "useCurrentUser").mockReturnValue({
      user: { id: "u" },
      isAnonymous: false,
    } as never)
    vi.spyOn(shoppingList, "useCurrentShoppingList").mockReturnValue(null)
    let finish!: (value: { listId: string; partial: boolean }) => void
    vi.spyOn(mutations, "buildShoppingList").mockReturnValue(
      new Promise(resolve => {
        finish = resolve
      })
    )
    vi.spyOn(toastManager, "add").mockReturnValue("t3")
    render(<AddToShoppingListButton recipe={recipe} />, { wrapper: wrap() })
    await click()
    expect(updateBlockers("navigation")).toEqual(["adding to shopping list"])
    finish({ listId: "new1", partial: false })
    expect(await screen.findByRole("button", { name: /add to shopping list/i })).toHaveTextContent(
      "Added"
    )
    await waitFor(() => expect(updateBlockers("navigation")).toEqual([]))
  })

  it("holds automatic updates while moving the recipe to a new list", async () => {
    vi.spyOn(currentUser, "useCurrentUser").mockReturnValue({
      user: { id: "u" },
      isAnonymous: false,
    } as never)
    vi.spyOn(shoppingList, "useCurrentShoppingList").mockReturnValue({
      id: "l1",
      createdAt: new Date().toISOString(),
    } as never)
    let finishBuild!: (value: { listId: string; partial: boolean }) => void
    vi.spyOn(mutations, "buildShoppingList").mockReturnValue(
      new Promise(resolve => {
        finishBuild = resolve
      })
    )
    let finishRemoval!: (value: never) => void
    vi.mocked(
      sdk.removeRecipeIngredientsFromListApiHouseholdsShoppingListsItemIdRecipeRecipeIdDeletePost
    ).mockReturnValueOnce(
      new Promise(resolve => {
        finishRemoval = resolve
      }) as never
    )
    const assign = vi.fn()
    vi.spyOn(window, "location", "get").mockReturnValue({ assign } as never)
    const addToast = vi.spyOn(toastManager, "add").mockReturnValue("t4")
    const { unmount } = render(<AddToShoppingListButton recipe={recipe} />, { wrapper: wrap() })
    await click()
    await waitFor(() => expect(addToast).toHaveBeenCalled())
    addToast.mock.calls[0][0].actionProps?.onClick?.({} as never)
    unmount()
    expect(updateBlockers("navigation")).toEqual(["moving recipe to a new shopping list"])
    finishBuild({ listId: "new2", partial: false })
    await waitFor(() =>
      expect(
        sdk.removeRecipeIngredientsFromListApiHouseholdsShoppingListsItemIdRecipeRecipeIdDeletePost
      ).toHaveBeenCalled()
    )
    expect(updateBlockers("navigation")).toEqual(["moving recipe to a new shopping list"])
    finishRemoval({ data: {} } as never)
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/shopping?list=new2"))
    expect(updateBlockers("navigation")).toEqual([])
  })
})
