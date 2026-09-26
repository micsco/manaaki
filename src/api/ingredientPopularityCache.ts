import type { QueryClient } from "@tanstack/react-query"

import { loadIngredientCatalog } from "./ingredientCatalog"
import { loadFoodRecipeCount } from "./ingredientPopularity"

const freshness = 5 * 60 * 1000
const retention = 24 * 60 * 60 * 1000
const queues = new WeakMap<QueryClient, { active: number; pending: (() => void)[] }>()
type StoredCounts = Record<string, { count: number; updatedAt: number }>

function storageKey(userId: string) {
  return `manaaki:ingredient-popularity:v1:${encodeURIComponent(userId)}`
}

function readStoredCounts(userId: string): StoredCounts {
  const counts: StoredCounts = {}
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(storageKey(userId)) ?? "{}")
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return counts
    for (const [id, entry] of Object.entries(stored)) {
      if (
        entry &&
        typeof entry === "object" &&
        "count" in entry &&
        typeof entry.count === "number" &&
        Number.isFinite(entry.count) &&
        entry.count >= 0 &&
        "updatedAt" in entry &&
        typeof entry.updatedAt === "number" &&
        entry.updatedAt <= Date.now() &&
        entry.updatedAt > Date.now() - retention
      )
        counts[id] = { count: entry.count, updatedAt: entry.updatedAt }
    }
  } catch {}
  return counts
}

function restoreCounts(client: QueryClient, userId: string) {
  for (const [id, entry] of Object.entries(readStoredCounts(userId))) {
    const key = ["ingredientRecipeCount", userId, id]
    if ((client.getQueryState(key)?.dataUpdatedAt ?? 0) < entry.updatedAt)
      client.setQueryData(key, entry.count, { updatedAt: entry.updatedAt })
  }
}

function storeCount(userId: string, id: string, count: number) {
  try {
    const counts = readStoredCounts(userId)
    counts[id] = { count, updatedAt: Date.now() }
    const recent = Object.entries(counts)
      .sort(([, left], [, right]) => right.updatedAt - left.updatedAt)
      .slice(0, 500)
    localStorage.setItem(storageKey(userId), JSON.stringify(Object.fromEntries(recent)))
  } catch {}
}

async function queuedCount(client: QueryClient, foodId: string, signal: AbortSignal) {
  let queue = queues.get(client)
  if (!queue) {
    queue = { active: 0, pending: [] }
    queues.set(client, queue)
  }
  await new Promise<void>(resolve => {
    const start = () => {
      queue.active++
      resolve()
    }
    if (queue.active < 4) start()
    else queue.pending.push(start)
  })
  try {
    signal.throwIfAborted()
    return await loadFoodRecipeCount(foodId, signal)
  } finally {
    queue.active--
    queue.pending.shift()?.()
  }
}

export function ingredientPopularitySnapshot(
  client: QueryClient,
  userId: string
): Record<string, number> {
  if (!userId) return {}
  restoreCounts(client, userId)
  const counts: Record<string, number> = {}
  for (const [key, count] of client.getQueriesData<number>({
    queryKey: ["ingredientRecipeCount", userId],
  })) {
    const updatedAt = client.getQueryState(key)?.dataUpdatedAt ?? 0
    if (
      typeof key[2] === "string" &&
      typeof count === "number" &&
      updatedAt > Date.now() - retention
    )
      counts[key[2]] = count
  }
  return counts
}

export async function prefetchFoodPopularity(
  client: QueryClient,
  userId: string,
  foodIds: string[],
  signal?: AbortSignal
) {
  if (!userId || signal?.aborted) return
  restoreCounts(client, userId)
  await Promise.allSettled(
    [...new Set(foodIds)].map(id =>
      client.fetchQuery({
        queryKey: ["ingredientRecipeCount", userId, id],
        staleTime: freshness,
        retry: false,
        queryFn: async ({ signal: requestSignal }) => {
          const count = await queuedCount(
            client,
            id,
            signal ? AbortSignal.any([signal, requestSignal]) : requestSignal
          )
          storeCount(userId, id, count)
          return count
        },
      })
    )
  )
}

export async function prefetchIngredientPopularity(
  client: QueryClient,
  userId: string,
  names: string[]
) {
  const searches = [
    ...new Set(names.map(name => name.trim().toLowerCase()).filter(name => name.length >= 2)),
  ]
  if (!userId || !searches.length) return
  try {
    const catalog = await client.fetchQuery({
      queryKey: ["ingredientCatalog", userId],
      queryFn: loadIngredientCatalog,
      staleTime: freshness,
    })
    const ids = catalog.food
      .filter(
        item => item.id && searches.some(search => item.name.trim().toLowerCase().includes(search))
      )
      .map(item => item.id!)
    await prefetchFoodPopularity(client, userId, ids)
  } catch {}
}
