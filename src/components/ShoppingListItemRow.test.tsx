import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { ShoppingListItemOutOutput } from "../api/generated"
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
})
