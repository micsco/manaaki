import { mdiCheck, mdiMinus } from "@mdi/js"
import { useCallback, useEffect, useState } from "react"
import { Icon } from "./Icon"

function stepKey(recipeId: string, index: number) {
  return `recipe-${recipeId}-step-${index}`
}

function readChecked(recipeId: string, indices: number[]): boolean[] {
  return indices.map(i => {
    try {
      const raw = sessionStorage.getItem(stepKey(recipeId, i))
      return raw ? JSON.parse(raw) === true : false
    } catch {
      return false
    }
  })
}

function useGroupCheckedState(recipeId: string, indices: number[]) {
  const [checked, setChecked] = useState(() => readChecked(recipeId, indices))

  useEffect(() => {
    setChecked(readChecked(recipeId, indices))

    const keys = new Set(indices.map(i => stepKey(recipeId, i)))
    const onSessionStorage = (e: Event) => {
      const { key } = (e as CustomEvent<{ key: string }>).detail
      if (keys.has(key)) setChecked(readChecked(recipeId, indices))
    }
    window.addEventListener("session-storage", onSessionStorage)
    return () => window.removeEventListener("session-storage", onSessionStorage)
  }, [recipeId, indices])

  const allChecked = checked.length > 0 && checked.every(Boolean)
  const someChecked = checked.some(Boolean)

  const toggleAll = useCallback(() => {
    const next = !allChecked
    for (const i of indices) {
      try {
        const key = stepKey(recipeId, i)
        sessionStorage.setItem(key, JSON.stringify(next))
        window.dispatchEvent(new CustomEvent("session-storage", { detail: { key } }))
      } catch (_) {
        // sessionStorage unavailable
      }
    }
    setChecked(indices.map(() => next))
  }, [allChecked, indices, recipeId])

  return { allChecked, someChecked, toggleAll }
}

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
  const { allChecked, someChecked, toggleAll } = useGroupCheckedState(recipeId, indices)

  return (
    <li className="mt-6 first:mt-0">
      <button
        type="button"
        onClick={toggleAll}
        className="flex w-full items-center gap-3 rounded-lg border border-gray-700 bg-gray-800/60 px-4 py-2.5 text-left transition-colors hover:border-gray-600 hover:bg-gray-800"
      >
        <div
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
            allChecked
              ? "border-orange-600 bg-orange-600"
              : someChecked
                ? "border-orange-500 bg-transparent"
                : "border-gray-500 bg-transparent"
          }`}
        >
          {allChecked && <Icon path={mdiCheck} size={0.5} className="text-white" aria-hidden />}
          {someChecked && !allChecked && (
            <Icon path={mdiMinus} size={0.5} className="text-orange-400" aria-hidden />
          )}
        </div>
        <span className="font-semibold text-gray-200 text-sm">{title}</span>
      </button>
    </li>
  )
}
