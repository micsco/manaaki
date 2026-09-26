import type { RecipeSummary, RecipeTimelineEventOut } from "../api/generated/types.gen"

export type DiscoveryItem = { recipe: RecipeSummary; reason: string; planned: boolean }
export type DiscoveryRow = { id: string; title: string; items: DiscoveryItem[] }

function calendarDay(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000
}

export function buildRecipeDiscovery(
  recipes: RecipeSummary[],
  events: RecipeTimelineEventOut[],
  householdId: string,
  plannedIds: string[],
  now: Date
): DiscoveryRow[] {
  const today = calendarDay(now)
  const sixMonthsAgo = new Date(now)
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const lastYear = new Date(now)
  lastYear.setFullYear(lastYear.getFullYear() - 1)
  const seasonalDay = calendarDay(lastYear)
  const daysByRecipe = new Map<string, Set<number>>()
  for (const event of events) {
    if (
      event.householdId !== householdId ||
      (event.eventType !== "info" && event.eventType !== "comment") ||
      !/ made this(?: for (?:breakfast|lunch|dinner|snack|dessert|drink)| as a side)?[.!]?$/i.test(
        event.subject
      ) ||
      !event.timestamp
    )
      continue
    const day = calendarDay(new Date(event.timestamp))
    if (!Number.isFinite(day) || day > today) continue
    const days = daysByRecipe.get(event.recipeId) ?? new Set<number>()
    days.add(day)
    daysByRecipe.set(event.recipeId, days)
  }
  const stats = recipes.flatMap(recipe => {
    if (!recipe.id || !recipe.slug) return []
    const days = [...(daysByRecipe.get(recipe.id) ?? [])]
    if (!days.length) return []
    return [
      {
        recipe,
        total: days.length,
        last: Math.max(...days),
        recent: days.filter(day => day >= today - 89).length,
        seasonal: days.filter(day => Math.abs(day - seasonalDay) <= 42).length,
      },
    ]
  })
  const used = new Set<string>()
  const planned = new Set(plannedIds)
  type Stats = (typeof stats)[number]
  function row(
    id: string,
    title: string,
    candidates: Stats[],
    score: (item: Stats) => number,
    reason: (item: Stats) => string
  ): DiscoveryRow {
    const items = candidates
      .filter(item => !used.has(item.recipe.id!))
      .sort(
        (a, b) => score(b) - score(a) || b.last - a.last || a.recipe.id!.localeCompare(b.recipe.id!)
      )
      .slice(0, 6)
      .map(item => {
        used.add(item.recipe.id!)
        return { recipe: item.recipe, reason: reason(item), planned: planned.has(item.recipe.id!) }
      })
    return { id, title, items }
  }
  const recent = row(
    "recent",
    "Recently popular",
    stats.filter(item => item.recent >= 2),
    item => item.recent,
    item => `Cooked on ${item.recent} days in the last 90 days`
  )
  const seasonal = row(
    "seasonal",
    "This time last year",
    stats.filter(item => item.seasonal >= 2),
    item => item.seasonal,
    item => `Cooked on ${item.seasonal} days around this time last year`
  )
  const forgotten = row(
    "forgotten",
    "Forgotten favourites",
    stats.filter(item => item.total >= 3 && item.last < calendarDay(sixMonthsAgo)),
    item => item.total,
    item =>
      `Cooked on ${item.total} days · Last made ${new Date(item.last * 86_400_000).toLocaleDateString("en-NZ", { month: "short", year: "numeric", timeZone: "UTC" })}`
  )
  return [recent, forgotten, seasonal].filter(section => section.items.length > 0)
}
