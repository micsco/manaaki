// src/hooks/useShoppingMutations.ts
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRef, useState } from "react"
import {
  createManyApiHouseholdsShoppingItemsCreateBulkPost,
  deleteOneApiHouseholdsShoppingItemsItemIdDelete,
  updateOneApiHouseholdsShoppingItemsItemIdPut,
} from "../api/generated/sdk.gen"
import type { ShoppingListItemOutOutput, ShoppingListOut } from "../api/generated/types.gen"
import { itemUpdateFromOutput } from "../utils/shopping"
import { shoppingListDetailQueryOptions } from "./useShoppingList"

export function useToggleItem(listId: string) {
  const qc = useQueryClient()
  const key = shoppingListDetailQueryOptions(listId).queryKey
  const pending = useRef(new Set<string>())
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const sync = () => setPendingIds(new Set(pending.current))

  function toggle(item: ShoppingListItemOutOutput) {
    if (pending.current.has(item.id)) return
    pending.current.add(item.id)
    sync()

    // Optimistic update
    qc.setQueryData<ShoppingListOut>(key, prev =>
      prev
        ? {
            ...prev,
            listItems: (prev.listItems ?? []).map(i =>
              i.id === item.id ? { ...i, checked: !item.checked } : i
            ),
          }
        : prev
    )

    // Call SDK synchronously so the call is visible to tests immediately
    updateOneApiHouseholdsShoppingItemsItemIdPut({
      path: { item_id: item.id },
      body: itemUpdateFromOutput(item, { checked: !item.checked }),
    })
      .then(res => {
        const updated = res.data?.updatedItems?.find(i => i.id === item.id)
        if (updated) {
          qc.setQueryData<ShoppingListOut>(key, prev =>
            prev
              ? {
                  ...prev,
                  listItems: (prev.listItems ?? []).map(i => (i.id === item.id ? updated : i)),
                }
              : prev
          )
        } else {
          qc.invalidateQueries({ queryKey: key })
        }
      })
      .catch(() => {
        // Rollback optimistic update on error
        qc.setQueryData<ShoppingListOut>(key, prev =>
          prev
            ? {
                ...prev,
                listItems: (prev.listItems ?? []).map(i =>
                  i.id === item.id ? { ...i, checked: item.checked } : i
                ),
              }
            : prev
        )
      })
      .finally(() => {
        pending.current.delete(item.id)
        sync()
      })
  }

  return { toggle, pendingIds }
}

export function useAddManualItem(listId: string) {
  const qc = useQueryClient()
  const key = shoppingListDetailQueryOptions(listId).queryKey
  const mutation = useMutation({
    mutationFn: async (display: string) => {
      const trimmed = display.trim()
      if (!trimmed) return
      await createManyApiHouseholdsShoppingItemsCreateBulkPost({
        body: [{ shoppingListId: listId, display: trimmed }],
      })
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
  return { add: (display: string) => mutation.mutateAsync(display).then(() => undefined) }
}

export function useDeleteItem(listId: string) {
  const qc = useQueryClient()
  const key = shoppingListDetailQueryOptions(listId).queryKey
  const mutation = useMutation({
    mutationFn: async (itemId: string) => {
      await deleteOneApiHouseholdsShoppingItemsItemIdDelete({ path: { item_id: itemId } })
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
  return { remove: (itemId: string) => mutation.mutateAsync(itemId).then(() => undefined) }
}
