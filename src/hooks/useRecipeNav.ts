import { useRecipeList } from "./useRecipeList"

export interface RecipeNavItem {
  id: string
  slug: string
  name: string
}

export interface RecipeNav {
  prevRecipe: RecipeNavItem | null
  nextRecipe: RecipeNavItem | null
}

function toNavItem(recipe: {
  id?: string | null
  slug?: string
  name?: string | null
}): RecipeNavItem | null {
  if (!recipe.id || !recipe.slug) return null
  return { id: recipe.id, slug: recipe.slug, name: recipe.name ?? "" }
}

export function useRecipeNav(currentId: string): RecipeNav {
  const recipes = useRecipeList()

  if (recipes.length === 0) return { prevRecipe: null, nextRecipe: null }

  const index = recipes.findIndex(r => r.id === currentId)
  if (index === -1) return { prevRecipe: null, nextRecipe: null }

  const prevRecipe = toNavItem(recipes[(index - 1 + recipes.length) % recipes.length])
  const nextRecipe = toNavItem(recipes[(index + 1) % recipes.length])

  return { prevRecipe, nextRecipe }
}
