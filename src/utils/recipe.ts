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
