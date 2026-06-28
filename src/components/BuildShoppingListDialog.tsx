// src/components/BuildShoppingListDialog.tsx
import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { mealPlanQueryOptions } from "../hooks/useMealPlan"
import { buildShoppingList } from "../hooks/useShoppingMutations"
import { computeRecipeIncrement, gatherPlanRecipes, shoppingDayRange } from "../utils/shopping"

const DAY_OPTIONS = [3, 4, 5, 7]

type Row = {
  recipeId: string
  name: string
  baseServings: number | null
  occurrences: number
  included: boolean
  value: number
}

export function BuildShoppingListDialog({
  open,
  onClose,
  onBuilt,
}: {
  open: boolean
  onClose: () => void
  onBuilt: (result: { listId: string; partial: boolean }) => void
}) {
  const [days, setDays] = useState<number | null>(null)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [building, setBuilding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const range = useMemo(() => (days ? shoppingDayRange(new Date(), days) : null), [days])
  const { data: entries } = useQuery({
    ...mealPlanQueryOptions(range?.start ?? "", range?.end ?? ""),
    enabled: Boolean(range),
  })

  // Seed review rows once entries for the chosen range arrive.
  const gathered = useMemo(() => (entries ? gatherPlanRecipes(entries) : null), [entries])
  if (gathered && rows === null && days) {
    setRows(
      gathered.map(g => ({
        ...g,
        included: true,
        value:
          g.baseServings && g.baseServings > 0 ? g.baseServings * g.occurrences : g.occurrences,
      }))
    )
  }

  if (!open) return null

  function pick(n: number) {
    setRows(null)
    setError(null)
    setDays(n)
  }

  async function confirm() {
    if (!rows) return
    const selections = rows
      .filter(r => r.included)
      .map(r => ({
        recipeId: r.recipeId,
        recipeIncrementQuantity: computeRecipeIncrement({
          mode: r.baseServings && r.baseServings > 0 ? "servings" : "multiplier",
          value: r.value,
          baseServings: r.baseServings,
        }),
      }))
    if (selections.length === 0) return
    setBuilding(true)
    setError(null)
    try {
      const result = await buildShoppingList({
        name: range ? `Shop · ${range.start}–${range.end}` : "Shopping list",
        selections,
      })
      onBuilt(result)
    } catch {
      setError(
        "Couldn't build the list. A stray empty list may remain — you can remove it in Mealie. Try again."
      )
    } finally {
      setBuilding(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-lg rounded-t-2xl bg-gray-900 p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold text-gray-100 text-lg">Build shopping list</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-200">
            Close
          </button>
        </div>

        <div className="mb-4 flex gap-2">
          {DAY_OPTIONS.map(n => (
            <button
              key={n}
              type="button"
              onClick={() => pick(n)}
              className={`rounded-full px-3 py-1.5 font-medium text-sm ${days === n ? "bg-orange-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}
            >
              Next {n} days
            </button>
          ))}
        </div>

        {days && rows === null && <p className="text-gray-500">Loading plan…</p>}
        {rows !== null && rows.length === 0 && (
          <p className="text-gray-400">Nothing planned with a recipe in the next {days} days.</p>
        )}

        {rows && rows.length > 0 && (
          <ul className="max-h-80 overflow-y-auto">
            {rows.map((r, idx) => (
              <li
                key={r.recipeId}
                className="flex items-center gap-3 border-gray-800 border-t py-3"
              >
                <input
                  type="checkbox"
                  checked={r.included}
                  aria-label={`Include ${r.name}`}
                  onChange={e =>
                    setRows(
                      rows.map((x, i) => (i === idx ? { ...x, included: e.target.checked } : x))
                    )
                  }
                  className="size-5"
                />
                <span className="min-w-0 flex-1 text-gray-200">{r.name}</span>
                <label className="flex items-center gap-1 text-gray-400 text-sm">
                  {r.baseServings && r.baseServings > 0 ? "servings" : "×"}
                  <input
                    type="number"
                    min={1}
                    value={r.value}
                    aria-label={`${r.baseServings && r.baseServings > 0 ? "Servings" : "Multiplier"} for ${r.name}`}
                    onChange={e =>
                      setRows(
                        rows.map((x, i) =>
                          i === idx ? { ...x, value: Number(e.target.value) || 1 } : x
                        )
                      )
                    }
                    className="w-16 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                  />
                </label>
              </li>
            ))}
          </ul>
        )}

        {error && <p className="mt-3 text-red-400 text-sm">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-gray-300 hover:text-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={building || !rows || rows.filter(r => r.included).length === 0}
            className="rounded-lg bg-orange-600 px-4 py-2 font-medium text-white hover:bg-orange-500 disabled:opacity-50"
          >
            {building ? "Creating…" : "Create list"}
          </button>
        </div>
      </div>
    </div>
  )
}
