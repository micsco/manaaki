// src/components/BuildShoppingListDialog.test.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import * as planHook from "../hooks/useMealPlan"
import * as mutations from "../hooks/useShoppingMutations"
import { toastManager } from "../lib/toastManager"
import { BuildShoppingListDialog } from "./BuildShoppingListDialog"

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

describe("BuildShoppingListDialog", () => {
  beforeEach(() => vi.restoreAllMocks())

  it("picks days, reviews planned recipes, and builds with scaled selections", async () => {
    vi.spyOn(planHook, "mealPlanQueryOptions").mockReturnValue({
      queryKey: ["mealplan", "x"],
      queryFn: async () => [
        {
          date: "2026-06-28",
          id: 1,
          groupId: "g",
          userId: "u",
          householdId: "h",
          recipeId: "r1",
          recipe: { id: "r1", name: "Soup", recipeServings: 4 },
        },
      ],
    } as never)
    const build = vi
      .spyOn(mutations, "buildShoppingList")
      .mockResolvedValue({ listId: "new1", partial: false })
    const onBuilt = vi.fn()

    render(<BuildShoppingListDialog open onClose={vi.fn()} onBuilt={onBuilt} />, {
      wrapper: wrap(),
    })

    await userEvent.click(screen.getByRole("button", { name: /next 4 days/i }))
    expect(await screen.findByText("Soup")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /create list/i }))

    await waitFor(() => expect(build).toHaveBeenCalled())
    const arg = build.mock.calls[0][0]
    expect(arg.selections).toEqual([{ recipeId: "r1", recipeIncrementQuantity: 1 }])
    await waitFor(() => expect(onBuilt).toHaveBeenCalledWith({ listId: "new1", partial: false }))
  })

  it("shows a success toast after building", async () => {
    vi.spyOn(planHook, "mealPlanQueryOptions").mockReturnValue({
      queryKey: ["mealplan", "z"],
      queryFn: async () => [
        {
          date: "2026-06-28",
          id: 1,
          groupId: "g",
          userId: "u",
          householdId: "h",
          recipeId: "r1",
          recipe: { id: "r1", name: "Soup", recipeServings: 4 },
        },
      ],
    } as never)
    vi.spyOn(mutations, "buildShoppingList").mockResolvedValue({
      listId: "new1",
      partial: false,
    })
    const addToast = vi.spyOn(toastManager, "add").mockReturnValue("t1")
    const onBuilt = vi.fn()

    render(<BuildShoppingListDialog open onClose={vi.fn()} onBuilt={onBuilt} />, {
      wrapper: wrap(),
    })

    await userEvent.click(screen.getByRole("button", { name: /next 4 days/i }))
    expect(await screen.findByText("Soup")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /create list/i }))

    await waitFor(() => expect(onBuilt).toHaveBeenCalled())
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Created a shopping list from 1 recipe" })
    )
  })

  it("shows an empty state when no recipes are planned in range", async () => {
    vi.spyOn(planHook, "mealPlanQueryOptions").mockReturnValue({
      queryKey: ["mealplan", "y"],
      queryFn: async () => [],
    } as never)
    render(<BuildShoppingListDialog open onClose={vi.fn()} onBuilt={vi.fn()} />, {
      wrapper: wrap(),
    })
    await userEvent.click(screen.getByRole("button", { name: /next 5 days/i }))
    expect(await screen.findByText(/nothing planned/i)).toBeInTheDocument()
  })
})
