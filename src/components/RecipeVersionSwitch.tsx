import { Link, useHydrated } from "@tanstack/react-router"

import type { RecipeOutput } from "../api/generated/types.gen"
import { usePostHog } from "../contexts/AnalyticsContext"
import { useRecipeList } from "../hooks/useRecipeList"
import { recipeVersions } from "../utils/recipeVersions"

const segment =
  "inline-flex min-h-9 items-center rounded-full px-3.5 font-sans text-sm font-semibold"

export function RecipeVersionSwitch({ recipe }: { recipe: RecipeOutput }) {
  const hydrated = useHydrated()
  const recipes = useRecipeList()
  const posthog = usePostHog()
  const versions = hydrated ? recipeVersions(recipe, recipes) : []
  if (versions.length === 0) return null

  return (
    <nav
      aria-label="Cooking method"
      className="inline-flex items-center gap-1 rounded-full bg-black/40 p-1 backdrop-blur-xs"
    >
      {versions.map(version =>
        version.href ? (
          <Link
            key={version.method}
            to={version.href}
            className={`${segment} text-white/75 transition-colors hover:bg-white/10 hover:text-white`}
            onClick={() =>
              posthog.capture("recipe_version_switched", {
                from_recipe_id: recipe.id,
                to_recipe_id: version.recipeId,
                to_method: version.method,
              })
            }
          >
            {version.label}
          </Link>
        ) : (
          <span
            key={version.method}
            aria-current="page"
            className={`${segment} bg-orange-600 text-white`}
          >
            {version.label}
          </span>
        )
      )}
    </nav>
  )
}
