import type { Nutrition, RecipeSettings } from "../api/generated/types.gen"

interface NutritionStat {
  label: string
  value: string
  unit: string
}

function parseStat(value: string | null | undefined): string | null {
  if (!value || value === "0" || value === "0.0") return null
  const num = Number.parseFloat(value)
  if (Number.isNaN(num)) return null
  return Number.isInteger(num) ? String(num) : num.toFixed(1)
}

function parseCalories(value: string | null | undefined): string | null {
  if (!value) return null
  const num = Number.parseFloat(value)
  if (Number.isNaN(num)) return null
  return Math.round(num).toString()
}

function buildPrimaryStats(nutrition: Nutrition): NutritionStat[] {
  const stats: NutritionStat[] = []

  const calories = parseCalories(nutrition.calories)
  if (calories) stats.push({ label: "Calories", value: calories, unit: "kcal" })

  const protein = parseStat(nutrition.proteinContent)
  if (protein) stats.push({ label: "Protein", value: protein, unit: "g" })

  const carbs = parseStat(nutrition.carbohydrateContent)
  if (carbs) stats.push({ label: "Carbs", value: carbs, unit: "g" })

  const fat = parseStat(nutrition.fatContent)
  if (fat) stats.push({ label: "Fat", value: fat, unit: "g" })

  return stats
}

function buildSecondaryStats(nutrition: Nutrition): NutritionStat[] {
  const stats: NutritionStat[] = []

  const satFat = parseStat(nutrition.saturatedFatContent)
  if (satFat) stats.push({ label: "Sat. fat", value: satFat, unit: "g" })

  const fibre = parseStat(nutrition.fiberContent)
  if (fibre) stats.push({ label: "Fibre", value: fibre, unit: "g" })

  const sugar = parseStat(nutrition.sugarContent)
  if (sugar) stats.push({ label: "Sugar", value: sugar, unit: "g" })

  const sodium = parseStat(nutrition.sodiumContent)
  if (sodium) stats.push({ label: "Sodium", value: sodium, unit: "mg" })

  return stats
}

function hasNutritionData(nutrition: Nutrition): boolean {
  return !!(
    nutrition.calories ||
    nutrition.proteinContent ||
    nutrition.carbohydrateContent ||
    nutrition.fatContent ||
    nutrition.fiberContent ||
    nutrition.sugarContent ||
    nutrition.sodiumContent ||
    nutrition.saturatedFatContent
  )
}

export function NutritionPanel({
  nutrition,
  settings,
}: {
  nutrition?: Nutrition | null
  settings?: RecipeSettings | null
}) {
  if (!settings?.showNutrition) return null
  if (!nutrition || !hasNutritionData(nutrition)) return null

  const primary = buildPrimaryStats(nutrition)
  const secondary = buildSecondaryStats(nutrition)

  if (primary.length === 0 && secondary.length === 0) return null

  return (
    <section aria-label="Nutrition information" className="mx-auto max-w-6xl px-6 pb-6 md:ps-10">
      <div className="rounded-xl border border-gray-800 bg-gray-900 px-5 py-4">
        <p className="mb-3 font-sans font-semibold text-gray-400 text-xs uppercase tracking-widest">
          Per serving
        </p>
        {primary.length > 0 && (
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {primary.map(stat => (
              <div key={stat.label} className="flex flex-col items-start">
                <span className="text-gray-400 text-xs">{stat.label}</span>
                <span className="font-semibold text-white text-xl tabular-nums leading-none">
                  {stat.value}
                  <span className="ml-0.5 font-normal text-gray-400 text-xs">{stat.unit}</span>
                </span>
              </div>
            ))}
          </div>
        )}
        {secondary.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-gray-800 border-t pt-3">
            {secondary.map(stat => (
              <span key={stat.label} className="text-gray-400 text-xs">
                {stat.label}:{" "}
                <span className="font-medium text-gray-300">
                  {stat.value}
                  {stat.unit}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
