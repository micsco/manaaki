import {
  addTransitionType,
  startTransition,
  useDeferredValue,
  useLayoutEffect,
  ViewTransition,
  type ReactNode,
} from "react"

import {
  prefersReducedMotion,
  recipeTransitionTypes,
  takeRecipeNavigation,
} from "../lib/recipeTransition"

// TanStack Router commits matches through useSyncExternalStore, which React renders
// synchronously. Deferring the recipe moves the visible swap into a transition lane so
// <ViewTransition> can animate it, and the layout effect tags that pending transition.
export function useDisplayedRecipe<T extends { id?: string | null }>(recipe: T): T {
  const displayedRecipe = useDeferredValue(recipe)
  const recipeId = recipe.id ?? ""
  const switching = displayedRecipe.id !== recipe.id

  useLayoutEffect(() => {
    if (!switching) return
    const direction = takeRecipeNavigation(recipeId)
    if (!direction || prefersReducedMotion()) return
    startTransition(() => addTransitionType(recipeTransitionTypes[direction]))
  }, [switching, recipeId])

  return displayedRecipe
}

const enterClasses = {
  [recipeTransitionTypes.next]: "recipe-slide-from-right",
  [recipeTransitionTypes.prev]: "recipe-slide-from-left",
  default: "none",
}

const exitClasses = {
  [recipeTransitionTypes.next]: "recipe-slide-to-left",
  [recipeTransitionTypes.prev]: "recipe-slide-to-right",
  default: "none",
}

export function RecipeTransition({
  recipeId,
  children,
}: {
  recipeId: string | null | undefined
  children: ReactNode
}) {
  return (
    <ViewTransition key={recipeId ?? ""} default="none" enter={enterClasses} exit={exitClasses}>
      {children}
    </ViewTransition>
  )
}
