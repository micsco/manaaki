import { usePostHog } from "@posthog/react"
import type { RecipeOutput } from "../api/generated/types.gen"
import { useGroupSlug } from "../hooks/useGroupSlug"
import { displayDomain, mealieRecipeUrl } from "../utils/recipe"
import { MealieLogo } from "./MealieLogo"
import { RecipeNotes } from "./RecipeNotes"

export function RecipeFooter({ recipe }: { recipe: RecipeOutput }) {
  const groupSlug = useGroupSlug()
  const mealieUrl = mealieRecipeUrl(recipe.slug, groupSlug)
  const sourceDomain = displayDomain(recipe.orgURL)
  const posthog = usePostHog()

  return (
    <div className="mx-auto max-w-6xl px-6 pb-12 md:px-10">
      <RecipeNotes notes={recipe.notes ?? []} />
      {(sourceDomain || mealieUrl) && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-gray-800 border-t pt-6 text-sm">
          {sourceDomain && (
            <span className="text-gray-500">
              Source:{" "}
              <a
                href={recipe.orgURL ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-orange-400 underline hover:text-orange-300"
              >
                {sourceDomain}
              </a>
            </span>
          )}
          {mealieUrl && (
            <a
              href={mealieUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-1.5 font-medium text-orange-400 transition-colors hover:text-orange-300"
              onClick={() =>
                posthog.capture("recipe_viewed_in_mealie", {
                  recipe_id: recipe.id,
                  recipe_name: recipe.name,
                })
              }
            >
              <MealieLogo className="h-4 w-4" />
              View in Mealie
            </a>
          )}
        </div>
      )}
    </div>
  )
}
