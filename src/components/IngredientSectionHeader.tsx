import { mdiCheck } from "@mdi/js"

import { useSessionStorageGroup } from "../hooks/useSessionStorage"
import { ingredientStorageKey } from "../utils/recipe"
import { Icon } from "./Icon"

interface IngredientSectionHeaderProps {
  title: string
  recipeId: string
  indices: number[]
}

export function IngredientSectionHeader({
  title,
  recipeId,
  indices,
}: IngredientSectionHeaderProps) {
  const { allChecked, toggleAll } = useSessionStorageGroup(
    indices.map(index => ingredientStorageKey(recipeId, index))
  )

  return (
    <h3 className="mt-8 border-t border-gray-800 first:mt-0 first:border-t-0">
      <button
        type="button"
        onClick={toggleAll}
        className="flex w-full items-center justify-between gap-3 py-3 text-left"
      >
        <span
          className={`text-sm font-semibold tracking-widest uppercase transition-colors ${
            allChecked ? "text-gray-500" : "text-gray-400"
          }`}
        >
          {title}
        </span>
        {allChecked && (
          <Icon path={mdiCheck} size={0.65} className="shrink-0 text-green-500" aria-hidden />
        )}
      </button>
    </h3>
  )
}
