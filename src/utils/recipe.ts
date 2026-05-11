import { parse as uuidParse, stringify as uuidStringify } from "uuid"
import type { RecipeIngredientOutput, RecipeStep } from "../api/generated/types.gen"

const MEALIE_BASE_URL =
  import.meta.env.VITE_PUBLIC_MEALIE_BASE_URL ?? "https://mealie.scottfamily.nz"

export function encodeRecipeId(uuid: string): string {
  return btoa(String.fromCharCode(...uuidParse(uuid)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

export function decodeRecipeId(encoded: string): string {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/")
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4)
  return uuidStringify(new Uint8Array(Array.from(atob(padded), c => c.charCodeAt(0))))
}

export function tryDecodeRecipeId(encoded: string): string | null {
  try {
    return decodeRecipeId(encoded)
  } catch {
    return null
  }
}

export function recipeUrl(id: string, slug: string): string {
  return `/recipes/${encodeRecipeId(id)}/${slug}`
}

export function mealieRecipeUrl(
  slug: string | null | undefined,
  groupSlug: string | null | undefined
): string | null {
  if (!slug || !groupSlug) return null
  return `${MEALIE_BASE_URL}/g/${groupSlug}/r/${slug}`
}

export function recipeImageUrl(
  id: string | null | undefined,
  size: "original" | "min-original",
  cacheKey?: string | null | unknown
): string | null {
  if (!id) return null
  const base = `/api/media/recipes/${id}/images/${size}.webp`
  return cacheKey && typeof cacheKey === "string" ? `${base}?v=${cacheKey}` : base
}

export function formatTime(t: string | null | undefined): string | null {
  if (!t || t.toLowerCase() === "none") return null
  const hoursMinutes = t.match(/^(\d+)\s+hours?\s+(\d+)\s+mins?(?:utes?)?$/)
  if (hoursMinutes) return `${hoursMinutes[1]}h ${hoursMinutes[2]}m`
  const hours = t.match(/^(\d+)\s+hours?$/)
  if (hours) return `${hours[1]}h`
  const minutes = t.match(/^(\d+)\s+mins?(?:utes?)?$/)
  if (minutes) return `${minutes[1]}m`
  return t
}

export function parseTimeMinutes(t: string | null | undefined): number | null {
  if (!t || t.toLowerCase() === "none") return null
  const hoursMinutes = t.match(/^(\d+)\s+hours?\s+(\d+)\s+mins?(?:utes?)?$/)
  if (hoursMinutes) return Number(hoursMinutes[1]) * 60 + Number(hoursMinutes[2])
  const hours = t.match(/^(\d+)\s+hours?$/)
  if (hours) return Number(hours[1]) * 60
  const minutes = t.match(/^(\d+)\s+mins?(?:utes?)?$/)
  if (minutes) return Number(minutes[1])
  return null
}

export function stepStorageKey(recipeId: string, index: number): string {
  return `recipe-${recipeId}-step-${index}`
}

export function ingredientStorageKey(recipeId: string, index: number): string {
  return `recipe-${recipeId}-ingredient-${index}`
}

export function servingsStorageKey(recipeId: string): string {
  return `recipe-${recipeId}-servings`
}

export function scaleQuantity(
  quantity: number | null | undefined,
  scale: number
): number | null | undefined {
  if (quantity == null || quantity === 0) return quantity
  return quantity * scale
}

export interface TitleGroup<T> {
  title: string | null
  items: { item: T; index: number }[]
}

export function groupByTitle<T extends { title?: string | null }>(items: T[]): TitleGroup<T>[] {
  const groups: TitleGroup<T>[] = []
  let current: TitleGroup<T> = { title: null, items: [] }

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.title) {
      if (current.items.length > 0 || current.title !== null) {
        groups.push(current)
      }
      current = { title: item.title, items: [] }
    } else {
      current.items.push({ item, index: i })
    }
  }
  if (current.items.length > 0 || current.title !== null) {
    groups.push(current)
  }

  return groups
}

function buildReferenceIndex(steps: RecipeStep[]): Map<string, number[]> {
  const map = new Map<string, number[]>()
  for (let si = 0; si < steps.length; si++) {
    for (const ref of steps[si].ingredientReferences ?? []) {
      if (!ref.referenceId) continue
      const existing = map.get(ref.referenceId)
      if (existing) {
        existing.push(si)
      } else {
        map.set(ref.referenceId, [si])
      }
    }
  }
  return map
}

function stepGroupLabel(steps: RecipeStep[], si: number): string {
  const summary = steps[si].summary?.trim()
  return summary || `Step ${si + 1}`
}

function flushGroup(
  groups: TitleGroup<RecipeIngredientOutput>[],
  current: TitleGroup<RecipeIngredientOutput>
): TitleGroup<RecipeIngredientOutput> {
  if (current.items.length > 0 || current.title !== null) {
    groups.push(current)
  }
  return { title: null, items: [] }
}

function addToStepGroup(
  groups: TitleGroup<RecipeIngredientOutput>[],
  openedStepGroups: Map<number, TitleGroup<RecipeIngredientOutput>>,
  steps: RecipeStep[],
  si: number,
  ing: RecipeIngredientOutput,
  index: number
): void {
  let group = openedStepGroups.get(si)
  if (!group) {
    group = { title: stepGroupLabel(steps, si), items: [] }
    openedStepGroups.set(si, group)
    groups.push(group)
  }
  group.items.push({ item: ing, index })
}

export function groupIngredients(
  ingredients: RecipeIngredientOutput[],
  steps?: RecipeStep[]
): TitleGroup<RecipeIngredientOutput>[] {
  const hasStepRefs = steps?.some(s => (s.ingredientReferences?.length ?? 0) > 0) ?? false

  if (!hasStepRefs) {
    return groupByTitle(ingredients)
  }

  const resolvedSteps = steps ?? []
  const refIndex = buildReferenceIndex(resolvedSteps)
  const groups: TitleGroup<RecipeIngredientOutput>[] = []
  let current: TitleGroup<RecipeIngredientOutput> = { title: null, items: [] }
  const openedStepGroups = new Map<number, TitleGroup<RecipeIngredientOutput>>()

  for (let i = 0; i < ingredients.length; i++) {
    const ing = ingredients[i]

    if (ing.title?.trim()) {
      current = flushGroup(groups, current)
      current = { title: ing.title.trim(), items: [] }
      continue
    }

    const stepIndices = ing.referenceId ? refIndex.get(ing.referenceId) : undefined

    if (!stepIndices || stepIndices.length === 0) {
      current.items.push({ item: ing, index: i })
      continue
    }

    current = flushGroup(groups, current)

    for (const si of stepIndices) {
      addToStepGroup(groups, openedStepGroups, resolvedSteps, si, ing, i)
    }
  }

  flushGroup(groups, current)

  return groups
}

const FRACTIONS: Record<number, string> = {
  0.125: "⅛",
  0.25: "¼",
  0.333: "⅓",
  0.375: "⅜",
  0.5: "½",
  0.625: "⅝",
  0.667: "⅔",
  0.75: "¾",
  0.875: "⅞",
}

export function formatQuantity(quantity: number | null | undefined): string {
  if (quantity == null) return ""
  if (quantity === 0) return ""

  const whole = Math.floor(quantity)
  const decimal = quantity - whole
  const roundedDecimal = Math.round(decimal * 1000) / 1000
  const fraction = FRACTIONS[roundedDecimal]

  if (fraction) {
    return whole > 0 ? `${whole}${fraction}` : fraction
  }

  const rounded = Math.round(quantity * 100) / 100
  return rounded % 1 === 0 ? String(rounded) : String(rounded)
}
