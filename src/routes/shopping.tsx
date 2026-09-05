import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { useState } from "react"

import { fetchCurrentUser } from "../api/auth"
import { configureApiClient } from "../api/client"
import { BuildShoppingListDialog } from "../components/BuildShoppingListDialog"
import { ShoppingListHistory } from "../components/ShoppingListHistory"
import { ShoppingListView } from "../components/ShoppingListView"
import { useCurrentShoppingList } from "../hooks/useShoppingList"
import { loginStartHref } from "../utils/loginReturn"

type ShoppingSearch = { list?: string; partial?: boolean }

export const Route = createFileRoute("/shopping")({
  head: () => ({ meta: [{ title: "Shopping · Manaaki" }] }),
  validateSearch: (s: Record<string, unknown>): ShoppingSearch => ({
    list: typeof s.list === "string" ? s.list : undefined,
    partial: s.partial === true || s.partial === "true" ? true : undefined,
  }),
  beforeLoad: async ({ location }) => {
    configureApiClient()
    const { isAnonymous } = await fetchCurrentUser()
    if (isAnonymous) throw redirect({ href: loginStartHref(location.href) })
  },
  component: ShoppingPage,
})

function ShoppingPage() {
  const { list: listParam, partial } = Route.useSearch()
  const current = useCurrentShoppingList()
  const listId = listParam ?? current?.id
  const navigate = useNavigate()
  const [buildOpen, setBuildOpen] = useState(false)

  return (
    <main className="bg-gray-950 text-gray-100">
      <div className="mx-auto max-w-2xl px-4 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-serif text-3xl font-bold">Shopping</h1>
          <button
            type="button"
            onClick={() => setBuildOpen(true)}
            className="min-h-11 rounded-full bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Build shopping list
          </button>
        </div>
      </div>
      {partial && (
        <p className="mx-auto max-w-2xl px-4 py-2 text-sm text-amber-400">
          Some items may be missing — the build didn't fully complete.
        </p>
      )}
      {listParam && listParam !== current?.id && (
        <p className="mx-auto max-w-2xl px-4 text-sm text-amber-400">Viewing a previous list.</p>
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
        onBuilt={({ listId, partial }) => {
          setBuildOpen(false)
          void navigate({
            to: "/shopping",
            search: { list: listId, ...(partial ? { partial: true } : {}) },
          })
        }}
      />
    </main>
  )
}
