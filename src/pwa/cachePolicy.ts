export interface CacheEntry {
  url: string
  group: string
  bytes: number
  hits: number
  accessedAt: number
  cachedAt: number
}

export const CACHE_LIMITS = { recipes: 150, recent: 20, other: 40, bytes: 100 * 1024 * 1024 }
export const RECIPE_FRESH_MS = 30 * 24 * 60 * 60 * 1000

export function cacheGroup(path: string): string | null {
  const image = /^\/api\/media\/recipes\/([^/]+)\/images\/[^/]+\.webp$/.exec(path)
  if (image) return `recipe:${image[1]}`
  const recipe = /^\/api\/recipes\/([^/]+)$/.exec(path)
  if (recipe) return `recipe:${recipe[1]}`
  if (
    /^\/api\/(recipes|households\/mealplans|households\/shopping\/lists(?:\/[^/]+)?|households\/shopping\/items(?:\/[^/]+)?)$/.test(
      path
    )
  )
    return `data:${path}`
  return null
}

export function evictionCandidates(
  entries: CacheEntry[],
  now = Date.now(),
  limits = CACHE_LIMITS
): string[] {
  const groups = new Map<
    string,
    { urls: string[]; bytes: number; hits: number; accessedAt: number }
  >()
  for (const entry of entries) {
    const group = groups.get(entry.group) ?? { urls: [], bytes: 0, hits: 0, accessedAt: 0 }
    group.urls.push(entry.url)
    group.bytes += entry.bytes
    group.hits = Math.max(group.hits, entry.hits)
    group.accessedAt = Math.max(group.accessedAt, entry.accessedAt)
    groups.set(entry.group, group)
  }
  const all = [...groups.entries()]
  const recent = new Set(
    all
      .filter(([key]) => key.startsWith("recipe:"))
      .sort((a, b) => b[1].accessedAt - a[1].accessedAt)
      .slice(0, limits.recent)
      .map(([key]) => key)
  )
  const score = ([key, value]: (typeof all)[number]) =>
    (recent.has(key) ? 1_000_000 : 0) +
    (1 + Math.log2(1 + value.hits)) / (1 + Math.max(0, now - value.accessedAt) / RECIPE_FRESH_MS)
  all.sort((a, b) => score(b) - score(a))
  let bytes = 0
  let recipes = 0
  let other = 0
  const removed: string[] = []
  for (const [key, group] of all) {
    const recipe = key.startsWith("recipe:")
    if (
      bytes + group.bytes > limits.bytes ||
      (recipe ? recipes >= limits.recipes : other >= limits.other)
    ) {
      removed.push(...group.urls)
    } else {
      bytes += group.bytes
      if (recipe) recipes++
      else other++
    }
  }
  return removed
}
