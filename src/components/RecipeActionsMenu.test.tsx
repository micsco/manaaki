import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, expect, it, vi } from "vitest"

import { useCurrentUser } from "../hooks/useCurrentUser"
import { render, screen } from "../test/render"
import { RecipeActionsMenu } from "./RecipeActionsMenu"
vi.mock("../hooks/useCurrentUser", () => ({ useCurrentUser: vi.fn() }))
vi.mock("./RecipeRepair", () => ({
  RecipeRepair: () => <button>Review title and ingredients</button>,
}))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/new-version">{children}</a>,
}))
vi.mock("./AddToShoppingListButton", () => ({
  AddToShoppingListButton: () => <button>Add to shopping list</button>,
}))
beforeEach(() =>
  vi.mocked(useCurrentUser).mockReturnValue({ user: {} as never, isAnonymous: false })
)
it("reveals secondary shopping actions and dismisses with Escape", async () => {
  const user = userEvent.setup()
  render(<RecipeActionsMenu recipe={{}} />)
  expect(screen.queryByRole("button", { name: "Add to shopping list" })).not.toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Recipe actions" }))
  expect(screen.getByRole("button", { name: "Add to shopping list" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Review title and ingredients" })).toBeVisible()
  await user.keyboard("{Escape}")
  expect(screen.queryByRole("button", { name: "Add to shopping list" })).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Recipe actions" })).toHaveFocus()
})
it.each([undefined, { user: null, isAnonymous: true }])(
  "hides private actions without authentication: %s",
  current => {
    vi.mocked(useCurrentUser).mockReturnValue(current)
    render(<RecipeActionsMenu recipe={{}} />)
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  }
)
it("offers to create another version with AI", async () => {
  const user = userEvent.setup()
  render(
    <RecipeActionsMenu recipe={{ id: "1135368a-1a28-4b47-a422-dbf9d3a7bbc0", slug: "soup" }} />
  )
  await user.click(screen.getByRole("button", { name: "Recipe actions" }))
  expect(screen.getByRole("link", { name: "Create another version with AI…" })).toBeVisible()
})
