import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"

import type { IngredientMatch } from "../api/ingredientCatalog"
import { loadFoodRecipeCount } from "../api/ingredientPopularity"
import { rankIngredientMatches } from "../utils/ingredientMatches"

export function IngredientSuggestions({
  id,
  items,
  query,
  userId,
  popularityEnabled,
}: {
  id: string
  items: IngredientMatch[]
  query: string
  userId: string
  popularityEnabled: boolean
}) {
  const normalized = query.trim().toLowerCase()
  const [settledQuery, setSettledQuery] = useState(normalized)
  useEffect(() => {
    const timer = setTimeout(() => setSettledQuery(normalized), 300)
    return () => clearTimeout(timer)
  }, [normalized])
  const client = useQueryClient()
  const foodIds = items
    .filter(item => item.id && item.name.trim().toLowerCase().includes(settledQuery))
    .map(item => item.id!)
  const { data: recipeCounts } = useQuery({
    queryKey: ["ingredientPopularity", userId, foodIds],
    enabled:
      popularityEnabled &&
      settledQuery.length >= 2 &&
      normalized === settledQuery &&
      foodIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async ({ signal }) => {
      const counts: Record<string, number> = {}
      const pending = [...foodIds]
      await Promise.all(
        Array.from({ length: Math.min(4, pending.length) }, async () => {
          let foodId: string | undefined
          while (!signal.aborted && (foodId = pending.shift())) {
            const currentId = foodId
            try {
              counts[currentId] = await client.fetchQuery({
                queryKey: ["ingredientRecipeCount", userId, currentId],
                queryFn: ({ signal }) => loadFoodRecipeCount(currentId, signal),
                staleTime: 5 * 60 * 1000,
                retry: false,
              })
            } catch {
              continue
            }
          }
        })
      )
      return counts
    },
  })
  return (
    <datalist id={id}>
      {rankIngredientMatches(items, query, recipeCounts).map(item => (
        <option key={item.id} value={item.name}>
          {item.name}
        </option>
      ))}
    </datalist>
  )
}
