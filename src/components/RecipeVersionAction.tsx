import { Link } from "@tanstack/react-router"

import type { RecipeOutput } from "../api/generated/types.gen"
import { encodeRecipeId } from "../utils/recipe"

export function RecipeVersionAction({ recipe }: { recipe: RecipeOutput }) {
  if (!recipe.id || !recipe.slug) return null
  return (
    <Link
      to="/recipes/$id/$slug/new-version"
      params={{ id: encodeRecipeId(recipe.id), slug: recipe.slug }}
      className="flex min-h-11 w-full items-center rounded-xl px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-800"
    >
      Create another version with AI…
    </Link>
  )
}
