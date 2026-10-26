import type { RecipeOutput } from "../api/generated"
import type { DraftSource } from "../utils/recipeVersionDraft"
import { cookingMethod } from "../utils/recipeVersions"
import type { DraftRequestRecipe } from "./recipeVersionAi"

function minutes(seconds: number | null | undefined): number | null {
  return seconds ? Math.round(seconds / 60) : null
}

export function toDraftRecipe(recipe: RecipeOutput): DraftRequestRecipe {
  const waiting = recipe.extras?.waitingTime
  return {
    name: recipe.name ?? "Recipe",
    description: recipe.description ?? "",
    servings: recipe.recipeServings ?? null,
    method: cookingMethod(recipe),
    ingredients: (recipe.recipeIngredient ?? []).map(line =>
      [line.title ? `[${line.title}]` : "", line.display || line.note || line.originalText || ""]
        .filter(Boolean)
        .join(" ")
    ),
    steps: (recipe.recipeInstructions ?? []).map(step => step.text ?? "").filter(Boolean),
    notes: (recipe.notes ?? []).map(note => ({ title: note.title ?? "", text: note.text ?? "" })),
    prepMinutes: minutes(recipe.prepTimeSeconds),
    cookMinutes: minutes(recipe.performTimeSeconds),
    totalMinutes: minutes(recipe.totalTimeSeconds),
    waitingNote: typeof waiting === "string" && waiting.trim() ? waiting.trim() : null,
  }
}

export function toSource(recipe: RecipeOutput, draftRecipe: DraftRequestRecipe): DraftSource {
  return {
    name: draftRecipe.name,
    method: draftRecipe.method,
    ingredients: (recipe.recipeIngredient ?? []).map((line, index) => ({
      text: draftRecipe.ingredients[index],
      quantity: line.quantity || null,
    })),
    steps: draftRecipe.steps,
  }
}
