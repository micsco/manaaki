import { queryOptions } from "@tanstack/react-query"

import {
  getAllApiHouseholdsMealplansGet,
  getAllApiRecipesTimelineEventsGet,
} from "../api/generated/sdk.gen"
import type { RecipeTimelineEventOut } from "../api/generated/types.gen"

export function recipeDiscoveryQueryOptions(userId: string, householdId: string, today: string) {
  return queryOptions({
    queryKey: ["recipeDiscovery", userId, householdId, today],
    queryFn: async ({ signal }) => {
      async function history() {
        const events: RecipeTimelineEventOut[] = []
        let page = 1
        let totalPages = 1
        do {
          const { data } = await getAllApiRecipesTimelineEventsGet({
            query: {
              page,
              perPage: 500,
              orderBy: "timestamp",
              orderDirection: "desc",
            },
            signal,
          })
          if (!data) throw new Error("Could not load cooking history")
          events.push(...data.items.filter(event => event.householdId === householdId))
          totalPages = data.total_pages ?? 1
          page++
        } while (page <= totalPages)
        return events
      }
      async function upcoming() {
        const end = new Date(`${today}T12:00:00`)
        end.setDate(end.getDate() + 13)
        const endDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`
        const ids = new Set<string>()
        let page = 1
        let totalPages = 1
        do {
          const { data } = await getAllApiHouseholdsMealplansGet({
            query: { start_date: today, end_date: endDate, perPage: 500, page },
            signal,
          })
          if (!data) throw new Error("Could not load upcoming meals")
          for (const entry of data.items) {
            if (entry.recipeId && entry.date >= today && entry.date <= endDate)
              ids.add(entry.recipeId)
          }
          totalPages = data.total_pages ?? 1
          page++
        } while (page <= totalPages)
        return [...ids]
      }
      const [events, plannedIds] = await Promise.all([history(), upcoming()])
      return { events, plannedIds }
    },
    staleTime: 15 * 60_000,
    gcTime: 24 * 60 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  })
}
