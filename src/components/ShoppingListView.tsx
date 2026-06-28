// src/components/ShoppingListView.tsx
import { useState } from "react"
import { useShoppingListDetail } from "../hooks/useShoppingList"
import { useAddManualItem, useDeleteItem, useToggleItem } from "../hooks/useShoppingMutations"
import { groupItemsByAisle } from "../utils/shopping"
import { ShoppingListItemRow } from "./ShoppingListItemRow"

export function ShoppingListView({ listId }: { listId: string }) {
  const { data: list, isLoading } = useShoppingListDetail(listId)
  const { toggle, pendingIds } = useToggleItem(listId)
  const { add } = useAddManualItem(listId)
  const { remove } = useDeleteItem(listId)
  const [draft, setDraft] = useState("")

  if (isLoading || !list) return <p className="p-6 text-gray-500">Loading…</p>

  const items = list.listItems ?? []
  const groups = groupItemsByAisle(items, list.labelSettings ?? [])
  const allChecked = items.length > 0 && items.every(i => i.checked)

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24">
      <form
        className="sticky top-0 z-10 flex gap-2 bg-gray-950 py-3"
        onSubmit={e => {
          e.preventDefault()
          if (!draft.trim()) return
          add(draft)
          setDraft("")
        }}
      >
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Add an item…"
          aria-label="Add an item"
          className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100"
        />
        <button
          type="submit"
          className="rounded-lg bg-orange-600 px-4 py-2 font-medium text-white hover:bg-orange-500"
        >
          Add
        </button>
      </form>

      {allChecked && (
        <p className="rounded-lg bg-green-900/30 px-4 py-3 text-green-300">
          All done — everything's checked off. 🎉
        </p>
      )}

      {groups.map(group => (
        <section key={group.labelId ?? "none"} className="mt-5">
          <h2 className="mb-1 font-semibold text-gray-400 text-sm uppercase tracking-wide">
            {group.name}
          </h2>
          <ul>
            {group.items.map(item => (
              <ShoppingListItemRow
                key={item.id}
                item={item}
                disabled={pendingIds.has(item.id)}
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
