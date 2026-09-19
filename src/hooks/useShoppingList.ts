import { queryOptions, useQuery } from "@tanstack/react-query"

import {
  getAllApiHouseholdsShoppingListsGet,
  getOneApiHouseholdsShoppingListsItemIdGet,
  type OrderByNullPosition,
  type ShoppingListOut,
  type ShoppingListSummary,
} from "../api/generated"
import { liveQueryOptions } from "../lib/liveQueryOptions"

export const currentListQueryOptions = queryOptions({
  queryKey: ["shopping", "current"],
  queryFn: async (): Promise<ShoppingListSummary | null> => {
    const res = await getAllApiHouseholdsShoppingListsGet({
      query: {
        orderBy: "createdAt",
        orderDirection: "desc",
        orderByNullPosition: "last" as OrderByNullPosition,
        perPage: 1,
      },
    })
    if (!res.data) throw new Error("Failed to load shopping lists")
    return res.data.items?.[0] ?? null
  },
  ...liveQueryOptions,
})

export function useCurrentShoppingList(options?: {
  enabled?: boolean
}): ShoppingListSummary | null | undefined {
  return useQuery({ ...currentListQueryOptions, enabled: options?.enabled ?? true }).data
}

export function shoppingListDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["shopping", "list", id],
    queryFn: async (): Promise<ShoppingListOut> => {
      const res = await getOneApiHouseholdsShoppingListsItemIdGet({ path: { item_id: id } })
      if (!res.data) throw new Error("Failed to load shopping list")
      return res.data
    },
    ...liveQueryOptions,
  })
}

export function useShoppingListDetail(id: string | undefined) {
  return useQuery({ ...shoppingListDetailQueryOptions(id ?? ""), enabled: Boolean(id) })
}

export function shoppingHistoryQueryOptions(page: number) {
  return queryOptions({
    queryKey: ["shopping", "history", page],
    queryFn: async (): Promise<ShoppingListSummary[]> => {
      const res = await getAllApiHouseholdsShoppingListsGet({
        query: {
          orderBy: "createdAt",
          orderDirection: "desc",
          orderByNullPosition: "last" as OrderByNullPosition,
          page,
          perPage: 30,
        },
      })
      if (!res.data) throw new Error("Failed to load shopping history")
      return res.data.items ?? []
    },
    ...liveQueryOptions,
  })
}
