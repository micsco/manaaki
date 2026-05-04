import { Link } from "@tanstack/react-router"
import type { PlanEntryType, ReadPlanEntry } from "../api/generated/types.gen"
import { recipeImageUrl, recipeUrl } from "../utils/recipe"

const ENTRY_TYPE_STYLES: Record<PlanEntryType, string> = {
  breakfast: "bg-amber-900/30 text-amber-300 border border-amber-800/50",
  lunch: "bg-sky-900/30 text-sky-300 border border-sky-800/50",
  dinner: "bg-indigo-900/30 text-indigo-300 border border-indigo-800/50",
  side: "bg-green-900/30 text-green-300 border border-green-800/50",
  snack: "bg-orange-900/30 text-orange-300 border border-orange-800/50",
  drink: "bg-cyan-900/30 text-cyan-300 border border-cyan-800/50",
  dessert: "bg-pink-900/30 text-pink-300 border border-pink-800/50",
}

function entryTitle(entry: ReadPlanEntry): string {
  return entry.recipe?.name ?? entry.title ?? entry.text ?? "Meal"
}

function RecipeThumb({ entry }: { entry: ReadPlanEntry }) {
  const imageId = entry.recipe?.id
  const cacheKey = entry.recipe?.image
  const src = recipeImageUrl(imageId, "min-original", cacheKey)

  if (!src) {
    return <div className="h-full w-full bg-gray-800" aria-hidden="true" />
  }

  return <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
}

interface MealPlanEntryCardProps {
  entry: ReadPlanEntry
}

export function MealPlanEntryCard({ entry }: MealPlanEntryCardProps) {
  const title = entryTitle(entry)
  const typeStyle = entry.entryType ? ENTRY_TYPE_STYLES[entry.entryType] : null
  const recipeId = entry.recipe?.id
  const recipeSlug = entry.recipe?.slug

  const content = (
    <div className="flex items-center gap-3 overflow-hidden">
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md">
        <RecipeThumb entry={entry} />
      </div>
      <div className="min-w-0 flex-1">
        {entry.entryType && typeStyle && (
          <span
            className={`mb-1 inline-block rounded-full px-2 py-0.5 font-medium text-xs capitalize ${typeStyle}`}
          >
            {entry.entryType}
          </span>
        )}
        <p className="truncate font-medium text-gray-100 text-sm leading-snug">{title}</p>
      </div>
    </div>
  )

  if (recipeId && recipeSlug) {
    return (
      <Link
        to={recipeUrl(recipeId, recipeSlug)}
        className="block rounded-lg border border-gray-800 bg-gray-900 p-3 transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-950"
        aria-label={title}
      >
        {content}
      </Link>
    )
  }

  return <div className="rounded-lg border border-gray-800 bg-gray-900 p-3">{content}</div>
}
