import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { shoppingHistoryQueryOptions } from "../hooks/useShoppingList"

export function ShoppingListHistory({ currentId }: { currentId: string | undefined }) {
  const { data: lists } = useQuery(shoppingHistoryQueryOptions(1))
  const previous = (lists ?? []).filter(l => l.id !== currentId)
  if (previous.length === 0) return null
  return (
    <section className="mx-auto max-w-2xl px-4 pt-8">
      <h2 className="mb-2 font-semibold text-gray-400 text-sm uppercase tracking-wide">
        Previous lists
      </h2>
      <ul className="divide-y divide-gray-800">
        {previous.map(l => (
          <li key={l.id}>
            <Link
              to="/shopping"
              search={{ list: l.id }}
              className="block py-3 text-gray-300 hover:text-gray-100"
            >
              {l.name ?? "Untitled list"}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
