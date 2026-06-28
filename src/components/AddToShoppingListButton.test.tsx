// src/components/AddToShoppingListButton.test.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import * as sdk from "../api/generated/sdk.gen"
import * as currentUser from "../hooks/useCurrentUser"
import * as shoppingList from "../hooks/useShoppingList"
import { AddToShoppingListButton } from "./AddToShoppingListButton"

vi.mock("../api/generated/sdk.gen", () => ({
  addRecipeIngredientsToListApiHouseholdsShoppingListsItemIdRecipePost: vi
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

describe("AddToShoppingListButton", () => {
  beforeEach(() => vi.restoreAllMocks())

  it("shows a sign-in CTA when anonymous", () => {
    vi.spyOn(currentUser, "useCurrentUser").mockReturnValue({ user: null, isAnonymous: true })
    render(<AddToShoppingListButton recipe={recipe} />, { wrapper: wrap() })
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      "/api/auth/oauth"
    )
  })

  it("adds the recipe to the current list when authed", async () => {
    vi.spyOn(currentUser, "useCurrentUser").mockReturnValue({
      user: { id: "u" },
      isAnonymous: false,
    } as never)
    vi.spyOn(shoppingList, "useCurrentShoppingList").mockReturnValue({ id: "l1" } as never)
    const { default: userEvent } = await import("@testing-library/user-event")
    render(<AddToShoppingListButton recipe={recipe} />, { wrapper: wrap() })
    await userEvent.click(screen.getByRole("button", { name: /add to shopping list/i }))
    await waitFor(() =>
      expect(
        sdk.addRecipeIngredientsToListApiHouseholdsShoppingListsItemIdRecipePost
      ).toHaveBeenCalledWith({
        path: { item_id: "l1" },
        body: [{ recipeId: "r1", recipeIncrementQuantity: 1 }],
      })
    )
  })
})
