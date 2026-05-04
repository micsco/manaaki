import { queryOptions, useQuery } from "@tanstack/react-query"
import { getAllApiHouseholdsMealplansGet } from "../api/generated/sdk.gen"
import type { ReadPlanEntry } from "../api/generated/types.gen"

export function mealPlanQueryOptions(startDate: string, endDate: string) {
  return queryOptions({
    queryKey: ["mealplan", startDate, endDate],
    queryFn: async (): Promise<ReadPlanEntry[]> => {
      const response = await getAllApiHouseholdsMealplansGet({
        query: { start_date: startDate, end_date: endDate, perPage: 100 },
      })
      if (!response.data) throw new Error("Failed to load meal plan")
      return response.data.items.slice().sort((a, b) => a.date.localeCompare(b.date))
    },
    staleTime: 5 * 60_000,
  })
}

export function useMealPlan(startDate: string, endDate: string): ReadPlanEntry[] {
  const { data } = useQuery(mealPlanQueryOptions(startDate, endDate))
  return data ?? []
}

export function isoWeekBounds(weekOffset: number): { startDate: string; endDate: string } {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(now)
  monday.setDate(now.getDate() + mondayOffset + weekOffset * 7)
  monday.setHours(0, 0, 0, 0)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  return {
    startDate: toIsoDateString(monday),
    endDate: toIsoDateString(sunday),
  }
}

export function toIsoDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function todayIsoDateString(): string {
  return toIsoDateString(new Date())
}
