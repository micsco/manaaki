import { createFileRoute, redirect } from "@tanstack/react-router"
import { fetchCurrentUser } from "../api/auth"
import { configureApiClient } from "../api/client"
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

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <div className="mx-auto max-w-2xl px-4 pt-5">
        <h1 className="font-bold text-2xl">Shopping</h1>
      </div>
      {listId ? (
        <ShoppingListView listId={listId} />
      ) : current === null ? (
        <p className="mx-auto max-w-2xl px-4 py-10 text-gray-400">
          No shopping list yet — build one from your meal plan.
        </p>
      ) : (
        <p className="mx-auto max-w-2xl px-4 py-10 text-gray-500">Loading…</p>
      )}
    </main>
  )
}
