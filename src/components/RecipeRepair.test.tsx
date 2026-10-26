import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import * as parsing from "../api/recipeParsing"
import { readDraft } from "../hooks/usePersistentDraft"
import { resetUpdateHoldsForTesting, updateBlockers } from "../pwa/updateHolds"
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
afterEach(() => resetUpdateHoldsForTesting())

async function openAndRetitle(title: string) {
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: "Review title and ingredients" }))
  await user.clear(screen.getByLabelText("Recipe title"))
  await user.type(screen.getByLabelText("Recipe title"), title)
  return user
}
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

it("keeps an unsaved title through a reload", async () => {
  const first = render(<RecipeRepair recipe={recipe} />)
  await openAndRetitle("Lamb orzo bake")
  first.unmount()

  const user = userEvent.setup()
  render(<RecipeRepair recipe={recipe} />)
  await user.click(screen.getByRole("button", { name: "Review title and ingredients" }))
  expect(screen.getByLabelText("Recipe title")).toHaveValue("Lamb orzo bake")
})

it("drops an unsaved title once the recipe was renamed elsewhere", async () => {
  const first = render(<RecipeRepair recipe={recipe} />)
  await openAndRetitle("Lamb orzo bake")
  first.unmount()

  const user = userEvent.setup()
  render(<RecipeRepair recipe={{ ...recipe, name: "Greek lamb orzo" }} />)
  await user.click(screen.getByRole("button", { name: "Review title and ingredients" }))
  expect(screen.getByLabelText("Recipe title")).toHaveValue("Greek lamb orzo")
})

it("forgets the draft title once it is saved", async () => {
  render(<RecipeRepair recipe={recipe} />)
  const user = await openAndRetitle("Lamb orzo bake")
  await user.click(screen.getByRole("button", { name: "Save title" }))
  expect(await screen.findByText("Title saved.")).toBeVisible()
  expect(readDraft("recipe-repair:id:name", { base: recipe.name })).toBeNull()
})

it("forgets the draft title when the dialog is dismissed", async () => {
  render(<RecipeRepair recipe={recipe} />)
  const user = await openAndRetitle("Lamb orzo bake")
  await user.click(screen.getByRole("button", { name: "Done" }))
  expect(readDraft("recipe-repair:id:name", { base: recipe.name })).toBeNull()
})

it("holds app updates while the title is saving", async () => {
  vi.mocked(parsing.renameRecipe).mockReturnValue(new Promise(() => undefined))
  render(<RecipeRepair recipe={recipe} />)
  const user = await openAndRetitle("Lamb orzo bake")
  await user.click(screen.getByRole("button", { name: "Save title" }))
  expect(await screen.findByText("Updating recipe…")).toBeVisible()
  expect(updateBlockers("navigation")).toContain("renaming-recipe")
})
