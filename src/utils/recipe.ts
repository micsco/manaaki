const MEALIE_BASE_URL = "https://mealie.scottfamily.nz"

export function encodeRecipeId(uuid: string): string {
  return btoa(uuid).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export function decodeRecipeId(encoded: string): string {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/")
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4)
  return atob(padded)
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

// ISO 8601 duration — e.g. "PT1H30M" → "1h 30m"
export function formatTime(t: string | null | undefined): string | null {
  if (!t) return null
  return t.replace("PT", "").replace("H", "h ").replace("M", "m").trim()
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
