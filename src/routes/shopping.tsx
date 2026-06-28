import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { fetchCurrentUser } from "../api/auth"
import { configureApiClient } from "../api/client"
import { BuildShoppingListDialog } from "../components/BuildShoppingListDialog"
import { ShoppingListHistory } from "../components/ShoppingListHistory"
import { ShoppingListView } from "../components/ShoppingListView"
import { useCurrentShoppingList } from "../hooks/useShoppingList"

type ShoppingSearch = { list?: string }

export const Route = createFileRoute("/shopping")({
  head: () => ({ meta: [{ title: "Shopping · Manaaki" }] }),
  validateSearch: (s: Record<string, unknown>): ShoppingSearch => ({
    list: typeof s.list === "string" ? s.list : undefined,
  }),
  beforeLoad: async () => {
    configureApiClient()
    const { isAnonymous } = await fetchCurrentUser()
    if (isAnonymous) throw redirect({ href: "/api/auth/oauth" })
  },
  component: ShoppingPage,
})

function ShoppingPage() {
  const { list: listParam } = Route.useSearch()
  const current = useCurrentShoppingList()
  const listId = listParam ?? current?.id
  const navigate = useNavigate()
  const [buildOpen, setBuildOpen] = useState(false)

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <div className="mx-auto max-w-2xl px-4 pt-5">
        <div className="flex items-center gap-3">
          <h1 className="font-bold text-2xl">Shopping</h1>
          <button
            type="button"
            onClick={() => setBuildOpen(true)}
            className="rounded-lg bg-orange-600 px-3 py-1.5 font-medium text-sm text-white hover:bg-orange-500"
          >
            Build shopping list
          </button>
        </div>
      </div>
      {listParam && listParam !== current?.id && (
        <p className="mx-auto max-w-2xl px-4 text-amber-400 text-sm">Viewing a previous list.</p>
      )}
      {listId ? (
        <ShoppingListView listId={listId} />
      ) : current === null ? (
        <p className="mx-auto max-w-2xl px-4 py-10 text-gray-400">
          No shopping list yet — build one from your meal plan.
        </p>
      ) : (
        <p className="mx-auto max-w-2xl px-4 py-10 text-gray-500">Loading…</p>
      )}
      <ShoppingListHistory currentId={current?.id} />
      <BuildShoppingListDialog
        open={buildOpen}
        onClose={() => setBuildOpen(false)}
        onBuilt={({ listId }) => {
          setBuildOpen(false)
          navigate({ to: "/shopping", search: { list: listId } })
        }}
      />
    </main>
  )
}
