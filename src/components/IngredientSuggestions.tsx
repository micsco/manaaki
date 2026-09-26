import { Combobox } from "@base-ui/react/combobox"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"

import type { IngredientMatch } from "../api/ingredientCatalog"
import { loadFoodRecipeCount } from "../api/ingredientPopularity"
import { rankIngredientMatches } from "../utils/ingredientMatches"

export function IngredientSuggestions({
  id,
  items,
  value,
  label,
  disabled,
  onChange,
  userId,
  popularityEnabled,
}: {
  id: string
  items: IngredientMatch[]
  value: IngredientMatch | null | undefined
  label: string
  disabled: boolean
  onChange: (value: IngredientMatch | null) => void
  userId: string
  popularityEnabled: boolean
}) {
  const query = value?.name ?? ""
  const normalized = query.trim().toLowerCase()
  const [settledQuery, setSettledQuery] = useState(normalized)
  useEffect(() => {
    const timer = setTimeout(() => setSettledQuery(normalized), 300)
    return () => clearTimeout(timer)
  }, [normalized])
  const client = useQueryClient()
  const foodIds = items
    .filter(item => item.id && item.name.trim().toLowerCase().includes(settledQuery))
    .map(item => item.id!)
  const [recipeCounts, setRecipeCounts] = useState<Record<string, number>>({})
  useQuery({
    queryKey: ["ingredientPopularity", userId, foodIds],
    enabled:
      popularityEnabled &&
      settledQuery.length >= 2 &&
      normalized === settledQuery &&
      foodIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async ({ signal }) => {
      const counts: Record<string, number> = {}
      const pending = [...foodIds]
      await Promise.all(
        Array.from({ length: Math.min(4, pending.length) }, async () => {
          let foodId: string | undefined
          while (!signal.aborted && (foodId = pending.shift())) {
            const currentId = foodId
            try {
              counts[currentId] = await client.fetchQuery({
                queryKey: ["ingredientRecipeCount", userId, currentId],
                queryFn: ({ signal }) => loadFoodRecipeCount(currentId, signal),
                staleTime: 5 * 60 * 1000,
                retry: false,
              })
            } catch {
              continue
            }
          }
        })
      )
      return counts
    },
  })
  const suggestions = useMemo(
    () =>
      rankIngredientMatches(items, query, recipeCounts).filter(item =>
        item.name.trim().toLowerCase().includes(normalized)
      ),
    [items, query, recipeCounts, normalized]
  )
  function captureRanking() {
    const counts: Record<string, number> = {}
    for (const [key, count] of client.getQueriesData<number>({
      queryKey: ["ingredientRecipeCount", userId],
    })) {
      if (typeof key[2] === "string" && typeof count === "number") counts[key[2]] = count
    }
    setRecipeCounts(counts)
  }
  return (
    <Combobox.Root<IngredientMatch>
      items={suggestions}
      filter={null}
      value={items.find(item => item.id === value?.id && item.id) ?? null}
      inputValue={query}
      disabled={disabled}
      autoHighlight={false}
      highlightItemOnHover={false}
      itemToStringLabel={item => item.name}
      isItemEqualToValue={(item, selected) => item.id === selected.id}
      onInputValueChange={(name, details) => {
        if (details.reason !== "input-change") return
        const match = items.find(item => item.name.toLowerCase() === name.trim().toLowerCase())
        onChange(name.trim() ? (match ?? { name }) : null)
      }}
      onValueChange={match => {
        if (match) onChange(match)
      }}
    >
      <label htmlFor={id} className="block text-sm">
        {label}
      </label>
      <Combobox.Input
        id={id}
        aria-label={label}
        onFocus={captureRanking}
        className="mt-1 min-h-11 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 text-base focus-visible:outline-2 focus-visible:outline-orange-400"
      />
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} className="z-[70]" align="start">
          <Combobox.Popup className="w-[var(--anchor-width)] overflow-hidden rounded-lg border border-gray-700 bg-gray-900 text-gray-100 shadow-xl">
            <Combobox.Empty className="px-3 py-3 text-sm text-gray-400 empty:hidden">
              No matching suggestions
            </Combobox.Empty>
            <Combobox.List className="max-h-[min(18rem,var(--available-height))] overflow-y-auto overscroll-contain py-1">
              {(item: IngredientMatch) => (
                <Combobox.Item
                  key={item.id}
                  value={item}
                  onPointerDownCapture={event => {
                    // WebKit suppresses tap clicks when pointerdown is cancelled.
                    if (event.pointerType === "touch") event.preventBaseUIHandler()
                  }}
                  className="min-h-11 cursor-pointer px-3 py-2.5 text-sm hover:bg-orange-950 hover:text-orange-200 data-highlighted:bg-orange-950 data-highlighted:text-orange-200"
                >
                  {item.name}
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}
