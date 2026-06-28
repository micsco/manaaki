// src/components/AddToShoppingListButton.test.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import * as sdk from "../api/generated/sdk.gen"
import * as currentUser from "../hooks/useCurrentUser"
import * as shoppingList from "../hooks/useShoppingList"
import * as mutations from "../hooks/useShoppingMutations"
import { toastManager } from "../lib/toastManager"
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
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it("shows a sign-in CTA when anonymous", () => {
    vi.spyOn(currentUser, "useCurrentUser").mockReturnValue({ user: null, isAnonymous: true })
    render(<AddToShoppingListButton recipe={recipe} />, { wrapper: wrap() })
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      "/api/auth/oauth"
    )
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
    const addToast = vi.spyOn(toastManager, "add").mockReturnValue("t1" as never)
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
    const addToast = vi.spyOn(toastManager, "add").mockReturnValue("t2" as never)
    render(<AddToShoppingListButton recipe={recipe} />, { wrapper: wrap() })
    await click()
    await waitFor(() => expect(build).toHaveBeenCalled())
    expect(addToast.mock.calls[0][0].title).toMatch(/new shopping list/i)
    expect(
      sdk.addRecipeIngredientsToListApiHouseholdsShoppingListsItemIdRecipePost
    ).not.toHaveBeenCalled()
  })
})
