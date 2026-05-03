import { parse as uuidParse, stringify as uuidStringify } from "uuid"

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

export function stepStorageKey(recipeId: string, index: number): string {
  return `recipe-${recipeId}-step-${index}`
}

export function ingredientStorageKey(recipeId: string, index: number): string {
  return `recipe-${recipeId}-ingredient-${index}`
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
