import type { RecipeOutput } from "../../src/api/generated/types.gen"
import type { DraftRequestRecipe } from "../../src/server/recipeVersionAi"
import { toDraftRecipe, toSource } from "../../src/server/recipeVersionSource"
import type { DraftSource } from "../../src/utils/recipeVersionDraft"
import type { EvalCase } from "./cases"

export type CaseInput = {
  recipe: DraftRequestRecipe
  source: DraftSource
  reference: string | null
}

function stepsOf(recipe: RecipeOutput): string[] {
  return (recipe.recipeInstructions ?? []).map(step => step.text ?? "").filter(Boolean)
}

function withoutReference(recipe: RecipeOutput, pattern: RegExp) {
  const removed: string[] = []
  const recipeInstructions = (recipe.recipeInstructions ?? []).map(step => ({
    ...step,
    text: (step.text ?? "").replace(pattern, match => {
      removed.push(match.trim())
      return ""
    }),
  }))
  return { recipe: { ...recipe, recipeInstructions }, removed }
}

export function caseInput(
  example: EvalCase,
  original: RecipeOutput,
  referenceRecipe: RecipeOutput | null = null
): CaseInput {
  const stripped = example.referenceInSteps
    ? withoutReference(original, example.referenceInSteps)
    : { recipe: original, removed: [] }
  const loaded = toDraftRecipe(stripped.recipe)
  const recipe = example.method ? { ...loaded, method: example.method } : loaded
  const references = [
    ...stripped.removed,
    ...(referenceRecipe
      ? stepsOf(referenceRecipe).map((step, index) => `${index + 1}. ${step}`)
      : []),
  ]
  return {
    recipe,
    source: toSource(stripped.recipe, recipe),
    reference: references.length ? references.join("\n") : null,
  }
}
