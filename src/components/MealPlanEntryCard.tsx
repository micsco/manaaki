import { mdiTimerOutline } from "@mdi/js"
import { Link } from "@tanstack/react-router"
import type { PlanEntryType, ReadPlanEntry } from "../api/generated/types.gen"
import { formatTime, recipeImageUrl, recipeUrl } from "../utils/recipe"
import { Icon } from "./Icon"

const ENTRY_TYPE_LABEL: Record<PlanEntryType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  side: "Side",
  snack: "Snack",
  drink: "Drink",
  dessert: "Dessert",
}

export function entryTitle(entry: ReadPlanEntry): string {
  return entry.recipe?.name ?? entry.title ?? entry.text ?? "Meal"
}

interface MealPlanEntryCardProps {
  entry: ReadPlanEntry
  dayLabel?: string
  compact?: boolean
}

function CardInner({ entry, dayLabel, compact = false }: MealPlanEntryCardProps) {
  const title = entryTitle(entry)
  const typeLabel = entry.entryType ? ENTRY_TYPE_LABEL[entry.entryType] : null
  const imageId = entry.recipe?.id
  const cacheKey = entry.recipe?.image
  const src = recipeImageUrl(imageId, "min-original", cacheKey)
  const cookTime = formatTime(entry.recipe?.totalTime)

  const eyebrow = [dayLabel, typeLabel].filter(Boolean).join(" · ")

  const aspectClass = compact ? "aspect-[3/4]" : "aspect-[16/7] sm:aspect-[16/6]"
  const padClass = compact ? "px-2 py-2" : "px-5 py-4 sm:px-8 sm:py-6"
  const titleClass = compact
    ? "text-sm leading-tight"
    : "text-xl leading-tight drop-shadow sm:text-2xl"
  const eyebrowClass = compact ? "mb-0.5 text-[10px] leading-tight" : "mb-1 text-xs"

  return (
    <div className={`relative w-full overflow-hidden bg-gray-900 ${aspectClass}`}>
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="h-full w-full bg-gray-800" aria-hidden="true" />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

      <div className={`absolute right-0 bottom-0 left-0 ${padClass}`}>
        {eyebrow && (
          <p className={`font-semibold text-white/70 uppercase tracking-widest ${eyebrowClass}`}>
            {eyebrow}
          </p>
        )}
        <p className={`font-bold text-white ${titleClass}`}>{title}</p>
        {cookTime && !compact && (
          <p className="mt-2 flex items-center gap-1.5 text-white/60 text-xs">
            <Icon path={mdiTimerOutline} size={0.55} aria-hidden={true} />
            {cookTime}
          </p>
        )}
        {cookTime && compact && (
          <p className="mt-1 flex items-center gap-1 text-[10px] text-white/50">
            <Icon path={mdiTimerOutline} size={0.45} aria-hidden={true} />
            {cookTime}
          </p>
        )}
      </div>
    </div>
  )
}

export function MealPlanEntryCard({ entry, dayLabel, compact = false }: MealPlanEntryCardProps) {
  const recipeId = entry.recipe?.id
  const recipeSlug = entry.recipe?.slug
  const title = entryTitle(entry)

  if (recipeId && recipeSlug) {
    return (
      <Link
        to={recipeUrl(recipeId, recipeSlug)}
        className="block overflow-hidden focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-inset"
        aria-label={title}
      >
        <CardInner entry={entry} dayLabel={dayLabel} compact={compact} />
      </Link>
    )
  }

  return (
    <div className="overflow-hidden">
      <CardInner entry={entry} dayLabel={dayLabel} compact={compact} />
    </div>
  )
}
