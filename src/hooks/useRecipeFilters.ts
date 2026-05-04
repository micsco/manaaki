import {
  mdiClock,
  mdiCow,
  mdiFish,
  mdiFoodDrumstick,
  mdiLeaf,
  mdiPig,
  mdiPotSteam,
  mdiSheep,
  mdiTimerSand,
  mdiToasterOven,
} from "@mdi/js"
import { parseAsArrayOf, parseAsString, useQueryState } from "nuqs"
import { useMemo } from "react"
import type { RecipeSummary } from "../api/generated/types.gen"
import { parseTimeMinutes } from "../utils/recipe"

export type TimeBucket = "under30" | "30to60" | "60to120" | "over120"

export const TIME_BUCKETS: { value: TimeBucket; label: string; icon: string }[] = [
  { value: "under30", label: "Under 30m", icon: mdiTimerSand },
  { value: "30to60", label: "30–60m", icon: mdiClock },
  { value: "60to120", label: "1–2h", icon: mdiClock },
  { value: "over120", label: "2h+", icon: mdiClock },
]

export const PROTEIN_OPTIONS: { value: string; label: string; icon: string }[] = [
  { value: "chicken", label: "Chicken", icon: mdiFoodDrumstick },
  { value: "beef", label: "Beef", icon: mdiCow },
  { value: "pork", label: "Pork", icon: mdiPig },
  { value: "fish", label: "Fish", icon: mdiFish },
  { value: "lamb", label: "Lamb", icon: mdiSheep },
  { value: "vegetarian", label: "Vegetarian", icon: mdiLeaf },
]

export const TOOL_OPTIONS: { value: string; label: string; icon: string }[] = [
  { value: "slow cooker", label: "Slow cooker", icon: mdiPotSteam },
  { value: "air fryer", label: "Air fryer", icon: mdiToasterOven },
]

function matchesTimeFilter(totalTime: string | null | undefined, bucket: TimeBucket): boolean {
  const minutes = parseTimeMinutes(totalTime)
  if (minutes === null) return false
  if (bucket === "under30") return minutes < 30
  if (bucket === "30to60") return minutes >= 30 && minutes < 60
  if (bucket === "60to120") return minutes >= 60 && minutes < 120
  return minutes >= 120
}

function recipeNameFields(recipe: RecipeSummary): string[] {
  return [
    ...(recipe.tools ?? []).map(t => t.name ?? ""),
    ...(recipe.tags ?? []).map(t => t.name ?? ""),
    ...(recipe.recipeCategory ?? []).map(c => c.name ?? ""),
  ].map(n => n.toLowerCase())
}

function matchesKeyword(recipe: RecipeSummary, keyword: string): boolean {
  return recipeNameFields(recipe).some(n => n.includes(keyword.toLowerCase()))
}

function matchesSearch(recipe: RecipeSummary, search: string): boolean {
  if (!search) return true
  return (recipe.name ?? "").toLowerCase().includes(search.toLowerCase())
}

function matchesProteins(recipe: RecipeSummary, proteins: string[]): boolean {
  if (proteins.length === 0) return true
  return proteins.some(p => matchesKeyword(recipe, p))
}

function matchesTools(recipe: RecipeSummary, tools: string[]): boolean {
  if (tools.length === 0) return true
  return tools.some(t => matchesKeyword(recipe, t))
}

function matchesTime(recipe: RecipeSummary, time: TimeBucket | null): boolean {
  if (!time) return true
  return matchesTimeFilter(recipe.totalTime, time)
}

export function applyRecipeFilters(
  recipes: RecipeSummary[],
  search: string,
  proteins: string[],
  tools: string[],
  time: TimeBucket | null
): RecipeSummary[] {
  return recipes.filter(
    recipe =>
      matchesSearch(recipe, search) &&
      matchesProteins(recipe, proteins) &&
      matchesTools(recipe, tools) &&
      matchesTime(recipe, time)
  )
}

export function useRecipeFilters(recipes: RecipeSummary[]) {
  const [search, setSearch] = useQueryState("q", parseAsString.withDefault(""))
  const [proteins, setProteins] = useQueryState(
    "protein",
    parseAsArrayOf(parseAsString).withDefault([])
  )
  const [tools, setTools] = useQueryState("tool", parseAsArrayOf(parseAsString).withDefault([]))
  const [time, setTime] = useQueryState("time", parseAsString.withDefault(""))

  const activeFilterCount = proteins.length + tools.length + (time ? 1 : 0) + (search ? 1 : 0)

  const filtered = useMemo(
    () => applyRecipeFilters(recipes, search, proteins, tools, (time as TimeBucket) || null),
    [recipes, search, proteins, tools, time]
  )

  function toggleProtein(value: string) {
    setProteins(prev => (prev.includes(value) ? prev.filter(p => p !== value) : [...prev, value]))
  }

  function toggleTool(value: string) {
    setTools(prev => (prev.includes(value) ? prev.filter(t => t !== value) : [...prev, value]))
  }

  function setTimeBucket(value: TimeBucket | null) {
    setTime(value ?? "")
  }

  function clearAll() {
    setSearch("")
    setProteins([])
    setTools([])
    setTime("")
  }

  return {
    search,
    setSearch,
    proteins,
    toggleProtein,
    tools,
    toggleTool,
    time: (time as TimeBucket) || null,
    setTimeBucket,
    activeFilterCount,
    clearAll,
    filtered,
  }
}
