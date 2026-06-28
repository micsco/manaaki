import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import { recipeListQueryOptions } from "./useRecipeList"

// Maps a recipeId to its name + slug, sourced from the cached recipe list, so
// shopping-list recipe references can be shown with names and linked.
export function useRecipeNameMap(): Map<string, { name: string; slug: string }> {
  const { data } = useQuery(recipeListQueryOptions)
  return useMemo(() => {
    const map = new Map<string, { name: string; slug: string }>()
    for (const r of data ?? []) {
      if (r.id && !map.has(r.id)) {
        map.set(r.id, { name: r.name ?? "Recipe", slug: r.slug ?? "" })
      }
    }
    return map
  }, [data])
}
