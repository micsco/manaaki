/**
 * Shared recipe utilities.
 */

/**
 * Build the media URL for a recipe image.
 *
 * @param id   - The recipe UUID
 * @param size - `"original"` for the detail page, `"min-original"` for list thumbnails
 */
export function recipeImageUrl(
  id: string | null | undefined,
  size: "original" | "min-original"
): string | null {
  if (!id) return null
  return `/api/media/recipes/${id}/images/${size}.webp`
}

/**
 * Rough ISO 8601 duration formatter.
 * Converts values like `"PT1H30M"` to `"1h 30m"`.
 */
export function formatTime(t: string | null | undefined): string | null {
  if (!t) return null
  return t.replace("PT", "").replace("H", "h ").replace("M", "m").trim()
}

/** Map of common decimal values to Unicode fraction characters. */
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

/**
 * Formats a numeric quantity into a human-readable string.
 * Converts common decimal fractions to Unicode fraction characters
 * (e.g. `0.5` → `"½"`, `1.5` → `"1½"`). Falls back to a rounded
 * decimal string for uncommon values.
 */
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

  // Fall back to clean number: drop trailing zeros
  const rounded = Math.round(quantity * 100) / 100
  return rounded % 1 === 0 ? String(rounded) : String(rounded)
}
