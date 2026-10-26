// src/components/ShoppingListView.test.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { ShoppingListOut } from "../api/generated"
import { readDraft } from "../hooks/usePersistentDraft"
import { shoppingListDetailQueryOptions } from "../hooks/useShoppingList"
import { resetUpdateHoldsForTesting, updateBlockers } from "../pwa/updateHolds"
import { ShoppingListView } from "./ShoppingListView"

const mockAdd = vi.fn()

vi.mock("../hooks/useShoppingMutations", async importOriginal => ({
  ...(await importOriginal<typeof import("../hooks/useShoppingMutations")>()),
  useAddManualItem: () => ({ add: mockAdd }),
}))

const emptyList = { id: "l1", listItems: [], labelSettings: [] }

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

describe("ShoppingListView add item", () => {
  afterEach(() => {
    mockAdd.mockReset()
    resetUpdateHoldsForTesting()
  })

  it("keeps a half-typed item through a reload", async () => {
    const user = userEvent.setup()
    const first = render(<ShoppingListView listId="l1" />, { wrapper: wrap(emptyList) })
    await user.type(screen.getByLabelText("Add an item"), "Oat milk")
    first.unmount()

    render(<ShoppingListView listId="l1" />, { wrapper: wrap(emptyList) })
    expect(screen.getByLabelText("Add an item")).toHaveValue("Oat milk")
  })

  it("clears the item only after it was added", async () => {
    const user = userEvent.setup()
    let finishAdd = () => {}
    mockAdd.mockReturnValue(new Promise<void>(resolve => (finishAdd = resolve)))
    render(<ShoppingListView listId="l1" />, { wrapper: wrap(emptyList) })
    await user.type(screen.getByLabelText("Add an item"), "Oat milk")
    await user.click(screen.getByRole("button", { name: "Add" }))

    expect(mockAdd).toHaveBeenCalledWith("Oat milk")
    expect(screen.getByLabelText("Add an item")).toHaveValue("Oat milk")
    expect(updateBlockers("navigation")).toContain("saving")

    finishAdd()
    await waitFor(() => expect(screen.getByLabelText("Add an item")).toHaveValue(""))
    expect(readDraft("shopping-list:l1:new-item")).toEqual({ value: "" })
    expect(updateBlockers("navigation")).not.toContain("saving")
  })

  it("keeps the item and explains when adding fails", async () => {
    const user = userEvent.setup()
    mockAdd.mockRejectedValue(new Error("offline"))
    render(<ShoppingListView listId="l1" />, { wrapper: wrap(emptyList) })
    await user.type(screen.getByLabelText("Add an item"), "Oat milk")
    await user.click(screen.getByRole("button", { name: "Add" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn’t add/i)
    expect(screen.getByLabelText("Add an item")).toHaveValue("Oat milk")
  })
})
