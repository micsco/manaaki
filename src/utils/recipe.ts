const MEALIE_BASE_URL = "https://mealie.scottfamily.nz"

export function mealieRecipeUrl(
  slug: string | null | undefined,
  groupSlug: string | null | undefined
): string | null {
  if (!slug || !groupSlug) return null
  return `${MEALIE_BASE_URL}/g/${groupSlug}/r/${slug}`
}

export function recipeImageUrl(
  id: string | null | undefined,
  size: "original" | "min-original"
): string | null {
  if (!id) return null
  return `/api/media/recipes/${id}/images/${size}.webp`
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

export function cleanNote(note: string | null | undefined): string | null {
  if (!note) return null
  const cleaned = note
    .replace(/\s*\bNote\s*\d*\s*$/i, "")
    .replace(/^,\s*/, "")
    .replace(/\s*,\s*,+/g, ",")
    .replace(/\s+,/g, ",")
    .replace(/,+\s*$/, "")
    .trim()
  return cleaned || null
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
