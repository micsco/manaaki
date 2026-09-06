import userEvent from "@testing-library/user-event"
import { beforeEach, expect, it, vi } from "vitest"

import * as parsing from "../api/recipeParsing"
import { render, screen } from "../test/render"
import { RecipeRepair } from "./RecipeRepair"

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
  vi.mocked(parsing.parseRecipeIngredients).mockResolvedValue({
    ...recipe,
    recipeIngredient: [{ quantity: 275, food: { name: "lamb" } }],
  })
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
  await user.click(screen.getByRole("button", { name: "Parse ingredients with AI" }))
  expect(await screen.findByText(/Ingredients parsed and saved/)).toBeVisible()
  expect(parsing.parseRecipeIngredients).toHaveBeenCalledWith("id")
  expect(screen.getByRole("button", { name: "Parse ingredients with AI" })).toBeDisabled()
  expect(invalidate).toHaveBeenCalled()
})
it("keeps failed parsing retryable without closing the dialog", async () => {
  vi.mocked(parsing.parseRecipeIngredients).mockRejectedValueOnce(new Error("AI unavailable"))
  const user = userEvent.setup()
  render(<RecipeRepair recipe={recipe} />)
  await user.click(screen.getByRole("button", { name: "Review title and ingredients" }))
  await user.click(screen.getByRole("button", { name: "Parse ingredients with AI" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("AI unavailable")
  expect(screen.getByRole("button", { name: "Parse ingredients with AI" })).toBeEnabled()
})
