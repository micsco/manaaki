import type { ShoppingListRecipeRefOut } from "../api/generated"
import { useRecipeNameMap } from "../hooks/useRecipeNameMap"
import { recipeUrl } from "../utils/recipe"

export function ShoppingListRecipes({ refs }: { refs: ShoppingListRecipeRefOut[] }) {
  const names = useRecipeNameMap()
  const ids = [...new Set(refs.map(r => r.recipeId))]
  if (ids.length === 0) return null
  return (
    <section className="pt-2 pb-2">
      <h2 className="mb-2 font-semibold text-gray-400 text-sm uppercase tracking-wide">
        Recipes in this list
      </h2>
      <ul className="flex flex-wrap gap-2">
        {ids.map(id => {
          const r = names.get(id)
          return (
            <li key={id}>
              {r?.slug ? (
                <a
                  href={recipeUrl(id, r.slug)}
                  className="inline-block rounded-full bg-gray-800 px-3 py-1 text-gray-200 text-sm transition-colors hover:bg-gray-700"
                >
                  {r.name}
                </a>
              ) : (
                <span className="inline-block rounded-full bg-gray-800 px-3 py-1 text-gray-400 text-sm">
                  {r?.name ?? "Recipe"}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
