export type RecipeNavDirection = "prev" | "next"

export const recipeTransitionTypes = {
  prev: "recipe-prev",
  next: "recipe-next",
} as const satisfies Record<RecipeNavDirection, string>

interface PendingRecipeNavigation {
  recipeId: string
  direction: RecipeNavDirection
}

let pendingNavigation: PendingRecipeNavigation | null = null

export function markRecipeNavigation(recipeId: string, direction: RecipeNavDirection): void {
  pendingNavigation = { recipeId, direction }
}

export function takeRecipeNavigation(recipeId: string): RecipeNavDirection | null {
  const pending = pendingNavigation
  pendingNavigation = null
  return pending?.recipeId === recipeId ? pending.direction : null
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
}
