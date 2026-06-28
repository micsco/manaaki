import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render as rtlRender } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { ShoppingListItemOutOutput } from "../api/generated"
import { recipeListQueryOptions } from "../hooks/useRecipeList"
import { render, screen } from "../test/render"
import { ShoppingListItemRow } from "./ShoppingListItemRow"

const base = {
  id: "i1",
  shoppingListId: "l1",
  groupId: "g1",
  householdId: "h1",
  display: "2 eggs",
  checked: false,
} satisfies ShoppingListItemOutOutput

describe("ShoppingListItemRow", () => {
  it("renders the item display text", () => {
    render(
      <ShoppingListItemRow
        item={base}
        onToggle={() => {
          // not tested here
        }}
        onDelete={() => {
          // not tested here
        }}
      />
    )
    expect(screen.getByText("2 eggs")).toBeInTheDocument()
  })
  it("calls onToggle when the row is tapped", async () => {
    const onToggle = vi.fn()
    render(
      <ShoppingListItemRow
        item={base}
        onToggle={onToggle}
        onDelete={() => {
          // not tested here
        }}
      />
    )
    await userEvent.click(screen.getByRole("button", { name: "2 eggs" }))
    expect(onToggle).toHaveBeenCalledOnce()
  })
  it("shows checked styling via aria-label when checked", () => {
    render(
      <ShoppingListItemRow
        item={{ ...base, checked: true }}
        onToggle={() => {
          // not tested here
        }}
        onDelete={() => {
          // not tested here
        }}
      />
    )
    expect(screen.getByRole("button", { name: /checked/i })).toBeInTheDocument()
  })

  it("has no recipe expander when the item has no recipe references", () => {
    render(<ShoppingListItemRow item={base} onToggle={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.queryByRole("button", { name: /show recipes/i })).not.toBeInTheDocument()
  })

  it("expands to show linked source recipes", async () => {
    const r1 = "11111111-1111-4111-8111-111111111111"
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    qc.setQueryData(recipeListQueryOptions.queryKey, [
      { id: r1, name: "Soup", slug: "soup" },
    ] as never)
    const item = { ...base, recipeReferences: [{ recipeId: r1 }] } as ShoppingListItemOutOutput
    rtlRender(
      <QueryClientProvider client={qc}>
        <ShoppingListItemRow item={item} onToggle={vi.fn()} onDelete={vi.fn()} />
      </QueryClientProvider>
    )
    expect(screen.queryByRole("link", { name: "Soup" })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /show recipes/i }))
    expect(screen.getByRole("link", { name: "Soup" })).toHaveAttribute(
      "href",
      expect.stringContaining("soup")
    )
  })
})
