import {
  getOneApiRecipesSlugGet,
  parseIngredientsApiParserIngredientsPost,
  patchOneApiRecipesSlugPatch,
} from "./generated/sdk.gen"
import type { RecipeOutput, RecipeIngredientInput, ParsedIngredient } from "./generated/types.gen"

export function unparsedIngredients(recipe: RecipeOutput) {
  return (recipe.recipeIngredient ?? []).filter(
    item =>
      !item.food &&
      !item.unit &&
      !item.quantity &&
      !item.referencedRecipe &&
      Boolean(item.note?.trim() || item.display?.trim())
  )
}

export function mergeParsedIngredients(
  recipe: RecipeOutput,
  parsed: (ParsedIngredient | null)[]
): RecipeIngredientInput[] {
  const pending = unparsedIngredients(recipe)
  if (pending.length !== parsed.length)
    throw new Error("Mealie returned an incomplete ingredient list. No ingredients were changed.")
  const replacements = new Map(
    pending.map((original, index) => {
      const result = parsed[index]
      if (!result) return [original, original] as const
      const text = original.note?.trim() || original.display?.trim() || ""
      if (result.input && result.input.trim() !== text)
        throw new Error(
          "Mealie returned ingredients in an unexpected order. No ingredients were changed."
        )
      return [
        original,
        {
          ...result.ingredient,
          originalText: original.originalText || text,
          referenceId: original.referenceId,
          title: original.title,
        },
      ] as const
    })
  )
  return (recipe.recipeIngredient ?? []).map(item => {
    const ingredient = replacements.get(item) ?? item
    return {
      ...ingredient,
      referencedRecipe: ingredient.referencedRecipe ? { id: ingredient.referencedRecipe.id } : null,
    }
  })
}

export async function parseRecipeIngredients(slug: string) {
  const loaded = await getOneApiRecipesSlugGet({ path: { slug }, cache: "reload" })
  if (!loaded.data || loaded.error) throw new Error("Could not load ingredients for parsing.")
  const recipe = loaded.data
  const pending = unparsedIngredients(recipe)
  if (!pending.length) return { recipe, parsed: [] }
  const parsed = await parseIngredientsApiParserIngredientsPost({
    body: {
      parser: "openai",
      ingredients: pending.map(item => item.note?.trim() || item.display?.trim() || ""),
    },
  })
  if (parsed.error || !parsed.data)
    throw new Error(
      "Ingredient parsing failed. Check Mealie’s AI provider configuration, then retry from Recipe actions."
    )
  mergeParsedIngredients(recipe, parsed.data)
  return {
    recipe,
    parsed: parsed.data.map((result, index) => ({
      ...result,
      input: result.input || pending[index].note?.trim() || pending[index].display?.trim() || "",
    })),
  }
}

export type IngredientReview = Awaited<ReturnType<typeof parseRecipeIngredients>>

export function ingredientNeedsReview(parsed: ParsedIngredient) {
  return (
    (parsed.confidence?.average ?? 0) < 0.85 ||
    Boolean(parsed.ingredient.food && !parsed.ingredient.food.id) ||
    Boolean(parsed.ingredient.unit && !parsed.ingredient.unit.id)
  )
}

export function ingredientReviewKey(userId: string, recipeId: string) {
  return ["ingredientReview", userId, recipeId]
}

export async function saveReviewedIngredients(
  review: IngredientReview,
  parsed: (ParsedIngredient | null)[]
) {
  const { recipe } = review
  const slug = recipe.id || recipe.slug
  if (!slug) throw new Error("Recipe identifier is missing.")
  for (const result of parsed) {
    if (!result) continue
    const { food, unit, quantity } = result.ingredient
    if ((food && !food.id) || (unit && !unit.id))
      throw new Error(
        "Match or create each suggested food and unit before saving, or keep the original ingredient."
      )
    if (quantity != null && (!Number.isFinite(quantity) || quantity < 0))
      throw new Error("Ingredient quantities must be valid, non-negative numbers.")
  }
  const ingredients = mergeParsedIngredients(recipe, parsed)
  const latest = await getOneApiRecipesSlugGet({
    path: { slug: recipe.id || slug },
    cache: "reload",
  })
  if (
    !latest.data ||
    latest.error ||
    JSON.stringify(latest.data.recipeIngredient) !== JSON.stringify(recipe.recipeIngredient)
  )
    throw new Error(
      "The ingredients changed while parsing. Reload the recipe and retry; no ingredients were overwritten."
    )
  const saved = await patchOneApiRecipesSlugPatch({
    path: { slug: recipe.id || slug },
    body: { recipeIngredient: ingredients },
  })
  if (saved.error || !saved.data)
    throw new Error("Ingredients were parsed but could not be saved. Retry from Recipe actions.")
  return saved.data
}

export async function renameRecipe(slug: string, name: string) {
  if (!name.trim()) throw new Error("Enter a recipe title.")
  const saved = await patchOneApiRecipesSlugPatch({ path: { slug }, body: { name: name.trim() } })
  if (saved.error || !saved.data) throw new Error("Could not save the recipe title.")
  return saved.data
}
