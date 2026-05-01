import { queryOptions, useQuery } from "@tanstack/react-query"
import { getAllApiRecipesGet } from "../api/generated/sdk.gen"
import type { RecipeSummary } from "../api/generated/types.gen"

const PAGE_SIZE = 50
const BASE_QUERY = { perPage: PAGE_SIZE, orderBy: "dateAdded", orderDirection: "desc" } as const

async function fetchPage(page: number) {
  const response = await getAllApiRecipesGet({ query: { ...BASE_QUERY, page } })
  if (!response.data) throw new Error("Failed to load recipes")
  return response.data
}

export const recipeListQueryOptions = queryOptions({
  queryKey: ["recipes", BASE_QUERY],
  queryFn: async (): Promise<RecipeSummary[]> => {
    const first = await fetchPage(1)
    const totalPages = first.total_pages ?? 1
    if (totalPages <= 1) return first.items

    const rest = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) => fetchPage(i + 2))
    )
    return [...first.items, ...rest.flatMap(p => p.items)]
  },
  staleTime: 60_000,
})

export function useRecipeList(): RecipeSummary[] {
  const { data } = useQuery(recipeListQueryOptions)
  return data ?? []
}
