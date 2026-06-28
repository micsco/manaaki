import type { ReadPlanEntry } from "../api/generated"
import { toIsoDateString } from "../hooks/useMealPlan"

export type GatheredRecipe = {
  recipeId: string
  name: string
  baseServings: number | null
  occurrences: number
}

export function shoppingDayRange(today: Date, days: number): { start: string; end: string } {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const end = new Date(start)
  end.setDate(start.getDate() + (days - 1))
  return { start: toIsoDateString(start), end: toIsoDateString(end) }
}

export function gatherPlanRecipes(entries: ReadPlanEntry[]): GatheredRecipe[] {
  const byId = new Map<string, GatheredRecipe>()
  for (const e of entries) {
    const recipeId = e.recipeId ?? e.recipe?.id ?? null
    if (!recipeId) continue
    const existing = byId.get(recipeId)
    if (existing) {
      existing.occurrences += 1
      continue
    }
    byId.set(recipeId, {
      recipeId,
      name: e.recipe?.name ?? e.title ?? "Recipe",
      baseServings: typeof e.recipe?.recipeServings === "number" ? e.recipe.recipeServings : null,
      occurrences: 1,
    })
  }
  return [...byId.values()]
}
