// src/components/ShoppingListView.test.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it } from "vitest"
import type { ShoppingListOut } from "../api/generated"
import { shoppingListDetailQueryOptions } from "../hooks/useShoppingList"
import { ShoppingListView } from "./ShoppingListView"

function wrap(seed: unknown) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  qc.setQueryData(shoppingListDetailQueryOptions("l1").queryKey, seed as ShoppingListOut)
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

describe("ShoppingListView", () => {
  it("groups items under aisle headings", () => {
    const seed = {
      id: "l1",
      listItems: [
        {
          id: "a",
          shoppingListId: "l1",
          display: "Milk",
          checked: false,
          labelId: "dairy",
          label: { id: "dairy", name: "Dairy", groupId: "g" },
        },
      ],
      labelSettings: [
        {
          id: "s",
          shoppingListId: "l1",
          labelId: "dairy",
          position: 0,
          label: { id: "dairy", name: "Dairy", groupId: "g" },
        },
      ],
    }
    render(<ShoppingListView listId="l1" />, { wrapper: wrap(seed) })
    expect(screen.getByText("Dairy")).toBeInTheDocument()
    expect(screen.getByText("Milk")).toBeInTheDocument()
  })

  it("shows a completed state when every item is checked", () => {
    const seed = {
      id: "l1",
      listItems: [{ id: "a", shoppingListId: "l1", display: "Milk", checked: true }],
      labelSettings: [],
    }
    render(<ShoppingListView listId="l1" />, { wrapper: wrap(seed) })
    expect(screen.getByText(/all done/i)).toBeInTheDocument()
  })
})
