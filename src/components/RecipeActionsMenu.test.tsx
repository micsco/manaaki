import userEvent from "@testing-library/user-event"
import { beforeEach, expect, it, vi } from "vitest"

import { useCurrentUser } from "../hooks/useCurrentUser"
import { render, screen } from "../test/render"
import { RecipeActionsMenu } from "./RecipeActionsMenu"
vi.mock("../hooks/useCurrentUser", () => ({ useCurrentUser: vi.fn() }))
vi.mock("./RecipeRepair", () => ({
  RecipeRepair: () => <button>Review title and ingredients</button>,
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
