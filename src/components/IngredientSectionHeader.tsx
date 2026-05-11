import { mdiCheck } from "@mdi/js"
import { useCallback, useEffect, useState } from "react"
import { ingredientStorageKey } from "../utils/recipe"
import { Icon } from "./Icon"

function readChecked(recipeId: string, indices: number[]): boolean[] {
  if (typeof window === "undefined") return indices.map(() => false)
  return indices.map(i => {
    try {
      const raw = sessionStorage.getItem(ingredientStorageKey(recipeId, i))
      return raw ? JSON.parse(raw) === true : false
    } catch {
      return false
    }
  })
}

function useGroupCheckedState(recipeId: string, indices: number[]) {
  const [checked, setChecked] = useState<boolean[]>(() => indices.map(() => false))

  useEffect(() => {
    setChecked(readChecked(recipeId, indices))

    const keys = new Set(indices.map(i => ingredientStorageKey(recipeId, i)))
    const onSessionStorage = (e: Event) => {
      const { key } = (e as CustomEvent<{ key: string }>).detail
      if (keys.has(key)) setChecked(readChecked(recipeId, indices))
    }
    window.addEventListener("session-storage", onSessionStorage)
    return () => window.removeEventListener("session-storage", onSessionStorage)
  }, [recipeId, indices])

  const allChecked = checked.length > 0 && checked.every(Boolean)

  const toggleAll = useCallback(() => {
    const next = !allChecked
    for (const i of indices) {
      try {
        const key = ingredientStorageKey(recipeId, i)
        sessionStorage.setItem(key, JSON.stringify(next))
        window.dispatchEvent(new CustomEvent("session-storage", { detail: { key } }))
      } catch (_) {
        // sessionStorage unavailable
      }
    }
    setChecked(indices.map(() => next))
  }, [allChecked, indices, recipeId])

  return { allChecked, toggleAll }
}

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
  const { allChecked, toggleAll } = useGroupCheckedState(recipeId, indices)

  return (
    <h3 className="mt-8 border-gray-800 border-t first:mt-0 first:border-t-0">
      <button
        type="button"
        onClick={toggleAll}
        className="flex w-full items-center justify-between gap-3 py-3 text-left"
      >
        <span
          className={`font-semibold text-sm uppercase tracking-widest transition-colors ${
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
