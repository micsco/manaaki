import { Link } from "@tanstack/react-router"
import type { LucideIcon } from "lucide-react"
import { ChevronLeft, Clock, Star, Users } from "lucide-react"
import type { RecipeOutput } from "../api/generated/types.gen"
import { formatTime } from "../utils/recipe"
import { Badge } from "./ui"

function HeroRating({ rating }: { rating: number }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <span className="flex items-center gap-1 font-sans font-semibold text-gray-400 text-xs uppercase tracking-widest">
        <Star className="h-3 w-3" aria-hidden="true" />
        Rating
      </span>
      <span className="text-sm leading-none">
        <span className="text-yellow-400">{"★".repeat(rating)}</span>
        <span className="text-gray-600">{"★".repeat(5 - rating)}</span>
      </span>
    </div>
  )
}

function HeroStat({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: LucideIcon
}) {
  return (
    <div className="flex flex-col items-start gap-1">
      <span className="flex items-center gap-1 font-sans font-semibold text-gray-400 text-xs uppercase tracking-widest">
        <Icon className="h-3 w-3" aria-hidden="true" />
        {label}
      </span>
      <span className="font-sans font-semibold text-sm text-white">{value}</span>
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
      {prepTime && <HeroStat icon={Clock} label="Prep" value={prepTime} />}
      {cookTime && <HeroStat icon={Clock} label="Cook" value={cookTime} />}
      {totalTime && <HeroStat icon={Clock} label="Total" value={totalTime} />}
      {recipe.recipeServings != null && recipe.recipeServings > 0 && (
        <HeroStat
          icon={Users}
          label="Serves"
          value={`${recipe.recipeServings}${recipe.recipeYield ? ` ${recipe.recipeYield}` : ""}`}
        />
      )}
      {rating != null && <HeroRating rating={rating} />}
    </div>
  )
}

export function RecipeHeader({ recipe, img }: { recipe: RecipeOutput; img: string | null }) {
  return (
    <div className="bg-gray-950 text-gray-100">
      {/* Hero */}
      <div className="relative h-[55vh] min-h-64 w-full overflow-hidden bg-gray-900">
        {/* Back link */}
        <Link
          to="/recipes"
          className="absolute top-4 left-4 z-20 inline-flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 font-medium text-sm text-white backdrop-blur-sm transition-colors hover:bg-black/60"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          All recipes
        </Link>

        {/* Hero image */}
        {img ? (
          <img
            src={img}
            alt={recipe.name ?? ""}
            className="h-full w-full object-cover"
            width={1600}
            height={900}
          />
        ) : (
          <div className="h-full w-full bg-gray-800" />
        )}

        {/* Gradient scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/40 to-transparent" />

        {/* Overlaid title + stats */}
        <div className="absolute right-0 bottom-0 left-0 px-6 pb-12 md:px-10 md:pb-16">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <h1 className="max-w-2xl font-bold font-serif text-4xl text-white leading-tight drop-shadow-lg md:text-5xl lg:text-6xl">
              {recipe.name}
            </h1>

            <HeroStats recipe={recipe} />
          </div>
        </div>
      </div>

      {/* Sub-hero strip: description + tags */}
      {(recipe.description || recipe.recipeCategory?.length || recipe.tags?.length) && (
        <div className="mx-auto max-w-6xl px-6 py-6 md:px-10">
          {recipe.description && (
            <p className="mb-4 max-w-3xl text-gray-300 text-lg leading-relaxed">
              {recipe.description}
            </p>
          )}
          {recipe.recipeCategory?.length || recipe.tags?.length ? (
            <div className="flex flex-wrap gap-2">
              {recipe.recipeCategory?.map(c => (
                <Badge key={c.id ?? c.slug} variant="category">
                  {c.name}
                </Badge>
              ))}
              {recipe.tags?.map(t => (
                <Badge key={t.id ?? t.slug} variant="tag">
                  {t.name}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
