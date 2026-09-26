import { Link } from "@tanstack/react-router"
import { useState } from "react"

import type { RecipeSummary } from "../api/generated/types.gen"
import { usePostHog } from "../contexts/AnalyticsContext"
import { recipeImageUrl, recipeUrl } from "../utils/recipe"
import { RecipeCardInfoBadges, RecipeCardToolBadges } from "./RecipeCardMeta"
import { RecipeCardTimingBadges } from "./RecipeCardTimingBadges"
import { Card } from "./ui"

function RecipeImage({
  recipe,
  heading: Heading,
}: {
  recipe: RecipeSummary
  heading: "h2" | "h3"
}) {
  const [failed, setFailed] = useState(false)
  const img = recipeImageUrl(recipe.id, "min-original", recipe.image)

  return (
    <div className="relative h-48 w-full">
      {img && !failed ? (
        <img
          src={img}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="h-full w-full bg-gray-800" aria-hidden="true" />
      )}
      <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/20 to-transparent" />
      <div className="absolute right-0 bottom-0 left-0 px-3 pb-2.5">
        <div className="flex items-end justify-between gap-2">
          <Heading className="line-clamp-2 text-base leading-tight font-bold text-balance text-white drop-shadow-sm">
            {recipe.name}
          </Heading>
          <RecipeCardInfoBadges recipe={recipe} />
        </div>
      </div>
    </div>
  )
}

export function RecipeCard({
  recipe,
  heading = "h2",
}: {
  recipe: RecipeSummary
  heading?: "h2" | "h3"
}) {
  const posthog = usePostHog()

  return (
    <Card hover className="relative overflow-hidden">
      {recipe.id && recipe.slug ? (
        <Link
          to={recipeUrl(recipe.id, recipe.slug)}
          className="block rounded-lg focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-950 focus:outline-hidden"
          onClick={() =>
            posthog.capture("recipe_card_clicked", {
              recipe_id: recipe.id,
              recipe_name: recipe.name,
              recipe_rating: recipe.rating,
              recipe_total_time: recipe.totalTime,
            })
          }
        >
          <RecipeImage recipe={recipe} heading={heading} />
        </Link>
      ) : (
        <RecipeImage recipe={recipe} heading={heading} />
      )}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-1.5 p-2">
        <RecipeCardTimingBadges recipe={recipe} />
        <RecipeCardToolBadges recipe={recipe} />
      </div>
    </Card>
  )
}
