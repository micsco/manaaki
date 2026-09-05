import { mdiCheck } from "@mdi/js"

import { useCookingStorageGroup } from "../hooks/useCookingStorage"
import { stepStorageKey } from "../utils/recipe"
import { Icon } from "./Icon"

interface InstructionSectionHeaderProps {
  title: string
  recipeId: string
  indices: number[]
}

export function InstructionSectionHeader({
  title,
  recipeId,
  indices,
}: InstructionSectionHeaderProps) {
  const { allChecked, toggleAll } = useCookingStorageGroup(
    indices.map(index => stepStorageKey(recipeId, index))
  )

  return (
    <h3 className="mt-8 first:mt-0">
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
