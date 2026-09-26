export function rankIngredientMatches<T extends { id?: string | null; name: string }>(
  items: T[],
  query: string,
  recipeCounts: Record<string, number> = {}
): T[] {
  const search = query.trim().toLowerCase()
  const rank = (name: string) => {
    const normalized = name.trim().toLowerCase()
    if (!search || normalized === search) return 0
    return normalized.includes(search) ? 1 : 2
  }
  return [...items].sort(
    (left, right) =>
      rank(left.name) - rank(right.name) ||
      (recipeCounts[right.id ?? ""] ?? 0) - (recipeCounts[left.id ?? ""] ?? 0) ||
      left.name.localeCompare(right.name, undefined, { sensitivity: "base" })
  )
}
