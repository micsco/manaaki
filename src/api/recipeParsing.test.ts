import { beforeEach, expect, it, vi } from "vitest"

import * as sdk from "./generated/sdk.gen"
import {
  ingredientNeedsReview,
  saveReviewedIngredients,
  mergeParsedIngredients,
  parseRecipeIngredients,
  renameRecipe,
} from "./recipeParsing"

vi.mock("./generated/sdk.gen", () => ({
  getOneApiRecipesSlugGet: vi.fn(),
  parseIngredientsApiParserIngredientsPost: vi.fn(),
  patchOneApiRecipesSlugPatch: vi.fn(),
}))
const recipe = {
  id: "recipe-id",
  name: "Lamb and orzo",
  recipeIngredient: [
    { note: "275g diced lamb", quantity: 0, referenceId: "original", title: "Main" },
    { quantity: 2, food: { name: "onion" }, referenceId: "keep" },
  ],
}
const parsed = [
  {
    input: "275g diced lamb",
    ingredient: {
      quantity: 275,
      food: { id: "lamb", name: "lamb" },
      unit: { id: "g", name: "g" },
      referenceId: "new",
      note: "diced",
    },
  },
]
beforeEach(() => {
  vi.mocked(sdk.getOneApiRecipesSlugGet).mockResolvedValue({ data: recipe } as never)
  vi.mocked(sdk.parseIngredientsApiParserIngredientsPost).mockResolvedValue({
    data: parsed,
  } as never)
  vi.mocked(sdk.patchOneApiRecipesSlugPatch).mockResolvedValue({ data: recipe } as never)
})
it("automatically parses only unstructured ingredients and preserves their identities", async () => {
  const review = await parseRecipeIngredients("lamb-and-orzo")
  expect(sdk.patchOneApiRecipesSlugPatch).not.toHaveBeenCalled()
  await saveReviewedIngredients(review, parsed)
  expect(sdk.parseIngredientsApiParserIngredientsPost).toHaveBeenCalledWith({
    body: { parser: "openai", ingredients: ["275g diced lamb"] },
  })
  expect(sdk.patchOneApiRecipesSlugPatch).toHaveBeenCalledWith({
    path: { slug: "recipe-id" },
    body: {
      recipeIngredient: [
        expect.objectContaining({
          quantity: 275,
          referenceId: "original",
          originalText: "275g diced lamb",
          title: "Main",
        }),
        expect.objectContaining({ quantity: 2, referenceId: "keep" }),
      ],
    },
  })
})
it("rejects missing or reordered parser results before saving", () => {
  expect(() => mergeParsedIngredients(recipe, [])).toThrow("incomplete")
  expect(() => mergeParsedIngredients(recipe, [{ ...parsed[0], input: "wrong" }])).toThrow(
    "unexpected order"
  )
})
it("does not save when the AI provider fails", async () => {
  vi.mocked(sdk.parseIngredientsApiParserIngredientsPost).mockResolvedValue({ error: {} } as never)
  await expect(parseRecipeIngredients("lamb")).rejects.toThrow("AI provider")
  expect(sdk.patchOneApiRecipesSlugPatch).not.toHaveBeenCalled()
})
it("does not overwrite ingredients edited during parsing", async () => {
  vi.mocked(sdk.getOneApiRecipesSlugGet)
    .mockResolvedValueOnce({ data: recipe } as never)
    .mockResolvedValueOnce({ data: { ...recipe, recipeIngredient: [] } } as never)
  const review = await parseRecipeIngredients("lamb")
  await expect(saveReviewedIngredients(review, parsed)).rejects.toThrow("changed while parsing")
  expect(sdk.patchOneApiRecipesSlugPatch).not.toHaveBeenCalled()
})
it("skips recipes that already have structured ingredients", async () => {
  vi.mocked(sdk.getOneApiRecipesSlugGet).mockResolvedValue({
    data: { recipeIngredient: [recipe.recipeIngredient[1]] },
  } as never)
  await parseRecipeIngredients("lamb")
  expect(sdk.parseIngredientsApiParserIngredientsPost).not.toHaveBeenCalled()
})
it("saves a corrected title without replacing the rest of the recipe", async () => {
  await renameRecipe("recipe-id", " One-pot lamb and orzo ")
  expect(sdk.patchOneApiRecipesSlugPatch).toHaveBeenCalledWith({
    path: { slug: "recipe-id" },
    body: { name: "One-pot lamb and orzo" },
  })
  await expect(renameRecipe("recipe-id", " ")).rejects.toThrow("title")
})

it.each([
  [{ confidence: { average: 0.84 }, ingredient: {} }, true],
  [{ confidence: { average: 0.85 }, ingredient: {} }, false],
  [{ ingredient: {} }, true],
  [{ confidence: { average: 1 }, ingredient: { food: { name: "new" } } }, true],
  [{ confidence: { average: 1 }, ingredient: { unit: { name: "new" } } }, true],
])("matches Mealie review rules for %j", (result, expected) => {
  expect(ingredientNeedsReview(result)).toBe(expected)
})
it("retains original ingredients when suggestions are declined", async () => {
  await saveReviewedIngredients({ recipe, parsed }, [null])
  expect(sdk.patchOneApiRecipesSlugPatch).toHaveBeenCalledWith(
    expect.objectContaining({
      body: {
        recipeIngredient: recipe.recipeIngredient.map(item => ({
          ...item,
          referencedRecipe: null,
        })),
      },
    })
  )
})
it("blocks saving unmatched foods, units and invalid amounts", async () => {
  for (const ingredient of [
    { food: { name: "new" } },
    { unit: { name: "new" } },
    { quantity: -1 },
    { quantity: NaN },
  ]) {
    await expect(
      saveReviewedIngredients({ recipe, parsed }, [{ input: parsed[0].input, ingredient }])
    ).rejects.toThrow()
  }
  expect(sdk.patchOneApiRecipesSlugPatch).not.toHaveBeenCalled()
})

it("retains original text for review when the parser omits its input echo", async () => {
  vi.mocked(sdk.parseIngredientsApiParserIngredientsPost).mockResolvedValue({
    data: [{ ingredient: parsed[0].ingredient }],
  } as never)
  const review = await parseRecipeIngredients("lamb")
  expect(review.parsed[0].input).toBe("275g diced lamb")
})
