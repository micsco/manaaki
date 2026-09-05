import {
  mdiAccountGroup,
  mdiChevronLeft,
  mdiChevronRight,
  mdiStarCircleOutline,
  mdiTimerOutline,
} from "@mdi/js"
import { usePostHog } from "@posthog/react"
import { Link } from "@tanstack/react-router"

import type { RecipeOutput } from "../api/generated/types.gen"
import type { RecipeNavItem } from "../hooks/useRecipeNav"
import { formatTime, recipeUrl } from "../utils/recipe"
import { AddToMealPlanButton } from "./AddToMealPlanButton"
import { AddToShoppingListButton } from "./AddToShoppingListButton"
import { Icon } from "./Icon"
import { ShareRecipeButton } from "./ShareRecipeButton"

function HeroRating({ rating }: { rating: number }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <span className="flex items-center gap-1 font-sans text-xs font-semibold tracking-widest text-gray-400 uppercase">
        <Icon path={mdiStarCircleOutline} size={0.6} aria-hidden={true} />
        Rating
      </span>
      <span className="text-sm leading-none">
        <span className="text-yellow-400">{"★".repeat(rating)}</span>
        <span className="text-gray-600">{"★".repeat(5 - rating)}</span>
      </span>
    </div>
  )
}

function HeroStat({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <span className="flex items-center gap-1 font-sans text-xs font-semibold tracking-widest text-gray-400 uppercase">
        <Icon path={icon} size={0.6} aria-hidden={true} />
        {label}
      </span>
      <span className="font-sans text-sm font-semibold text-white">{value}</span>
    </div>
  )
}

function HeroStats({ recipe }: { recipe: RecipeOutput }) {
  const prepTime = formatTime(recipe.prepTime)
  const cookTime = formatTime(recipe.cookTime)
  const totalTime = formatTime(recipe.totalTime)
  const rating = recipe.rating != null ? Math.round(recipe.rating) : null
  if (!prepTime && !cookTime && !totalTime && !recipe.recipeServings && rating == null) return null
  return (
    <div className="flex shrink-0 flex-wrap items-end gap-x-6 gap-y-3 pb-1">
      {prepTime && <HeroStat icon={mdiTimerOutline} label="Prep" value={prepTime} />}
      {cookTime && <HeroStat icon={mdiTimerOutline} label="Cook" value={cookTime} />}
      {totalTime && <HeroStat icon={mdiTimerOutline} label="Total" value={totalTime} />}
      {recipe.recipeServings != null && recipe.recipeServings > 0 && (
        <HeroStat
          icon={mdiAccountGroup}
          label="Serves"
          value={`${recipe.recipeServings}${recipe.recipeYield ? ` ${recipe.recipeYield}` : ""}`}
        />
      )}
      {rating != null && <HeroRating rating={rating} />}
    </div>
  )
}

export function RecipeHeader({
  recipe,
  img,
  prevRecipe,
  nextRecipe,
}: {
  recipe: RecipeOutput
  img: string | null
  prevRecipe?: RecipeNavItem | null
  nextRecipe?: RecipeNavItem | null
}) {
  const posthog = usePostHog()

  return (
    <div className="relative flex min-h-[55vh] w-full flex-col overflow-hidden bg-gray-900 md:h-[55vh] md:min-h-64">
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
        <Link
          to="/recipes"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-black/40 px-4 py-2 text-sm font-medium text-white backdrop-blur-xs transition-colors hover:bg-black/60"
        >
          <Icon path={mdiChevronLeft} size={0.75} aria-hidden={true} />
          All recipes
        </Link>
      </div>

      <div className="absolute top-18 right-4 left-4 z-20 flex flex-wrap items-center justify-end gap-2 sm:top-4 sm:left-auto">
        <AddToShoppingListButton recipe={recipe} />
        <ShareRecipeButton recipe={recipe} />
        {(prevRecipe || nextRecipe) && (
          <>
            {prevRecipe ? (
              <Link
                to={recipeUrl(prevRecipe.id, prevRecipe.slug)}
                aria-label="Previous recipe"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-black/40 p-2.5 text-white backdrop-blur-xs transition-colors hover:bg-black/60"
                onClick={() =>
                  posthog.capture("recipe_navigated", {
                    direction: "prev",
                    method: "click",
                    from_recipe_id: recipe.id,
                    from_recipe_name: recipe.name,
                    to_recipe_id: prevRecipe.id,
                    to_recipe_name: prevRecipe.name,
                  })
                }
              >
                <Icon path={mdiChevronLeft} size={0.75} aria-hidden={true} />
              </Link>
            ) : (
              <span className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-black/20 p-2.5 text-white/30">
                <Icon path={mdiChevronLeft} size={0.75} aria-hidden={true} />
              </span>
            )}
            {nextRecipe ? (
              <Link
                to={recipeUrl(nextRecipe.id, nextRecipe.slug)}
                aria-label="Next recipe"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-black/40 p-2.5 text-white backdrop-blur-xs transition-colors hover:bg-black/60"
                onClick={() =>
                  posthog.capture("recipe_navigated", {
                    direction: "next",
                    method: "click",
                    from_recipe_id: recipe.id,
                    from_recipe_name: recipe.name,
                    to_recipe_id: nextRecipe.id,
                    to_recipe_name: nextRecipe.name,
                  })
                }
              >
                <Icon path={mdiChevronRight} size={0.75} aria-hidden={true} />
              </Link>
            ) : (
              <span className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-black/20 p-2.5 text-white/30">
                <Icon path={mdiChevronRight} size={0.75} aria-hidden={true} />
              </span>
            )}
          </>
        )}
      </div>

      {img ? (
        <img
          src={img}
          alt={recipe.name ?? ""}
          className="absolute inset-0 h-full w-full object-cover"
          width={1600}
          height={900}
        />
      ) : (
        <div className="absolute inset-0 h-full w-full bg-gray-800" />
      )}

      <div className="absolute inset-0 bg-linear-to-t from-gray-950 via-gray-950/40 to-transparent" />

      <div className="relative mt-auto px-6 pt-52 pb-12 sm:pt-36 md:absolute md:right-0 md:bottom-0 md:left-0 md:px-10 md:pt-0 md:pb-16">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <h1 className="max-w-2xl font-serif text-4xl leading-tight font-bold text-white drop-shadow-lg md:text-5xl lg:text-6xl">
            {recipe.name}
          </h1>
          <div className="flex flex-col items-start gap-4">
            <HeroStats recipe={recipe} />
            <AddToMealPlanButton recipe={recipe} />
          </div>
        </div>
      </div>
    </div>
  )
}
