import { useQuery } from "@tanstack/react-query"
import { useState } from "react"

import type { RecipeSummary } from "../api/generated/types.gen"
import { toIsoDateString } from "../hooks/useMealPlan"
import { recipeDiscoveryQueryOptions } from "../hooks/useRecipeDiscovery"
import { buildRecipeDiscovery, type DiscoveryRow } from "../utils/recipeDiscovery"
import { RecipeCard } from "./RecipeCard"

export function RecipeDiscovery({
  userId,
  householdId,
  recipes,
  recipesReady,
  hidden,
}: {
  userId: string
  householdId: string
  recipes: RecipeSummary[]
  recipesReady: boolean
  hidden: boolean
}) {
  const [now] = useState(() => new Date())
  const { data, isError, isFetching, refetch } = useQuery(
    recipeDiscoveryQueryOptions(userId, householdId, toIsoDateString(now))
  )
  const [rows, setRows] = useState<DiscoveryRow[] | null>(null)
  if (rows === null && data && recipesReady) {
    setRows(buildRecipeDiscovery(recipes, data.events, householdId, data.plannedIds, now))
  }

  return (
    <div hidden={hidden}>
      {rows === null ? (
        isError ? (
          <div className="mb-6 rounded-lg border border-gray-800 p-4 text-sm text-gray-400">
            <p>Cooking suggestions are unavailable. You can still browse all recipes.</p>
            <button
              type="button"
              disabled={isFetching}
              onClick={() => void refetch()}
              className="mt-2 min-h-11 text-orange-400 underline disabled:opacity-50"
            >
              {isFetching ? "Trying again…" : "Retry suggestions"}
            </button>
          </div>
        ) : (
          <div role="status" aria-label="Loading cooking suggestions" className="mb-8 space-y-8">
            {["Recently popular", "Forgotten favourites", "This time last year"].map(title => (
              <div key={title}>
                <h2 className="mb-3 font-serif text-2xl text-gray-100">{title}</h2>
                <div className="h-64 animate-pulse rounded-lg bg-gray-900" aria-hidden="true" />
              </div>
            ))}
          </div>
        )
      ) : rows.length > 0 ? (
        <div className="mb-10 space-y-8">
          <p className="text-sm text-gray-400">
            For your household · Based on cooking history and your meal plan. Each recipe counts
            once per day.
          </p>
          {rows.map(row => (
            <section key={row.id} aria-labelledby={`discovery-${row.id}`}>
              <h2
                id={`discovery-${row.id}`}
                className="mb-3 font-serif text-2xl font-bold text-gray-100"
              >
                {row.title}
              </h2>
              <ul
                className="flex snap-x snap-proximity gap-4 overflow-x-auto pb-4"
                aria-label={row.title}
              >
                {row.items.map(item => (
                  <li key={item.recipe.id} className="w-64 shrink-0 snap-start sm:w-72">
                    <RecipeCard recipe={item.recipe} heading="h3" />
                    <p className="mt-2 text-sm text-gray-400">{item.reason}</p>
                    {item.planned && (
                      <p className="mt-1 text-xs font-medium text-orange-400">
                        On your plan in the next two weeks
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
      {rows !== null && rows.length > 0 && (
        <h2 className="mb-4 font-serif text-2xl font-bold text-gray-100">All recipes</h2>
      )}
    </div>
  )
}
