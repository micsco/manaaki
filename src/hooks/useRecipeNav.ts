import { useRecipeList } from "./useRecipeList"

export interface RecipeNav {
  prevSlug: string | null
  nextSlug: string | null
}

export function useRecipeNav(currentSlug: string): RecipeNav {
  const recipes = useRecipeList()

  if (recipes.length === 0) return { prevSlug: null, nextSlug: null }

  const index = recipes.findIndex(r => r.slug === currentSlug)
  if (index === -1) return { prevSlug: null, nextSlug: null }

  const prevSlug = recipes[(index - 1 + recipes.length) % recipes.length].slug ?? null
  const nextSlug = recipes[(index + 1) % recipes.length].slug ?? null

  return { prevSlug, nextSlug }
}
