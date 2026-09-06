// src/components/ShoppingListView.tsx
import { useState } from "react"

import { useShoppingListDetail } from "../hooks/useShoppingList"
import { useAddManualItem, useDeleteItem, useToggleItem } from "../hooks/useShoppingMutations"
import { useOnline } from "../pwa/useOnline"
import { groupItemsByAisle } from "../utils/shopping"
import { ShoppingListItemRow } from "./ShoppingListItemRow"
import { ShoppingListRecipes } from "./ShoppingListRecipes"
import { ShoppingSyncStatus } from "./ShoppingSyncStatus"

export function ShoppingListView({ listId }: { listId: string }) {
  const { data: list, isLoading } = useShoppingListDetail(listId)
  const { toggle, pendingIds } = useToggleItem(listId)
  const { add } = useAddManualItem(listId)
  const { remove } = useDeleteItem(listId)
  const online = useOnline()
  const [draft, setDraft] = useState("")

  if (isLoading || !list) return <p className="p-6 text-gray-500">Loading…</p>

  const items = list.listItems ?? []
  const groups = groupItemsByAisle(items, list.labelSettings ?? [])
  const allChecked = items.length > 0 && items.every(i => i.checked)

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24">
      <form
        className="sticky top-[env(safe-area-inset-top,0px)] z-10 flex gap-2 bg-gray-950 py-3"
        onSubmit={e => {
          e.preventDefault()
          if (!online || !draft.trim()) return
          void add(draft)
          setDraft("")
        }}
      >
        <input
          disabled={!online}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Add an item…"
          aria-label="Add an item"
          className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100"
        />
        <button
          type="submit"
          disabled={!online || !draft.trim()}
          className="rounded-lg bg-orange-600 px-4 py-2 font-medium text-white hover:bg-orange-500"
        >
          Add
        </button>
      </form>

      {!online && (
        <p className="py-2 text-sm text-gray-400">
          Check items off while offline. Adding and removing items needs a connection.
        </p>
      )}
      <ShoppingSyncStatus />
      <ShoppingListRecipes refs={list.recipeReferences ?? []} />

      {allChecked && (
        <p className="rounded-lg bg-green-900/30 px-4 py-3 text-green-300">
          All done — everything's checked off. 🎉
        </p>
      )}

      {groups.map(group => (
        <section key={group.labelId ?? "none"} className="mt-5">
          <h2 className="mb-1 text-sm font-semibold tracking-wide text-gray-400 uppercase">
            {group.name}
          </h2>
          <ul>
            {group.items.map(item => (
              <ShoppingListItemRow
                key={item.id}
                item={item}
                disabled={pendingIds.has(item.id)}
                deleteDisabled={!online}
                onToggle={() => toggle(item)}
                onDelete={() => remove(item.id)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
