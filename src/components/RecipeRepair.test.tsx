import userEvent from "@testing-library/user-event"
import { beforeEach, expect, it, vi } from "vitest"

import * as parsing from "../api/recipeParsing"
import { render, screen } from "../test/render"
import { RecipeRepair } from "./RecipeRepair"

vi.mock("./IngredientParsingAction", () => ({
  IngredientParsingAction: () => <button>Parse ingredients with AI</button>,
}))
const invalidate = vi.fn()
vi.mock("@tanstack/react-router", () => ({ useRouter: () => ({ invalidate }) }))
vi.mock("../api/recipeParsing", async original => ({
  ...(await original<typeof import("../api/recipeParsing")>()),
  parseRecipeIngredients: vi.fn(),
  renameRecipe: vi.fn(),
}))
const recipe = {
  id: "id",
  name: "Lamb and orzo",
  recipeIngredient: [{ note: "275g lamb", referenceId: "ref" }],
}
beforeEach(() => {
  vi.mocked(parsing.renameRecipe).mockResolvedValue(recipe)
})
it("lets a signed-in user correct the title and parse an existing import", async () => {
  const user = userEvent.setup()
  render(<RecipeRepair recipe={recipe} />)
  await user.click(screen.getByRole("button", { name: "Review title and ingredients" }))
  await user.clear(screen.getByLabelText("Recipe title"))
  await user.type(screen.getByLabelText("Recipe title"), "One-pot lamb and orzo")
  await user.click(screen.getByRole("button", { name: "Save title" }))
  expect(await screen.findByText("Title saved.")).toBeVisible()
  expect(parsing.renameRecipe).toHaveBeenCalledWith("id", "One-pot lamb and orzo")
  expect(screen.getByRole("button", { name: "Parse ingredients with AI" })).toBeVisible()
  expect(invalidate).toHaveBeenCalled()
})
