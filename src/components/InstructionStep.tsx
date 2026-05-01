import { mdiCheck } from "@mdi/js"
import { useCallback } from "react"
import type { RecipeStep } from "../api/generated/types.gen"
import { useSessionStorage } from "../hooks/useSessionStorage"
import { Icon } from "./Icon"

interface InstructionStepProps {
  step: RecipeStep
  index: number
  recipeId: string
  className?: string
}

export function InstructionStep({ step, index, recipeId, className = "" }: InstructionStepProps) {
  const storageKey = `recipe-${recipeId}-step-${index}`
  const [isChecked, setIsChecked] = useSessionStorage(storageKey, false)

  const handleToggle = useCallback(() => {
    setIsChecked(prev => !prev)
  }, [setIsChecked])

  const stepNumber = index + 1

  return (
    <li className={`group border-gray-800 border-t last:border-b ${className}`}>
      <button
        type="button"
        className="flex w-full cursor-pointer items-baseline gap-3 py-3 text-left transition-colors hover:text-gray-200"
        onClick={handleToggle}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            handleToggle()
          }
        }}
        aria-label={`Step ${stepNumber}${isChecked ? ", completed" : ""}`}
      >
        <span
          className={`shrink-0 font-semibold tabular-nums transition-colors ${
            isChecked ? "text-gray-600" : "text-orange-500"
          }`}
        >
          {stepNumber}.
        </span>
        <span
          className={`min-w-0 flex-1 leading-relaxed transition-colors ${
            isChecked ? "truncate text-gray-600" : "text-gray-300"
          }`}
        >
          {step.text}
        </span>
        {isChecked && (
          <Icon path={mdiCheck} size={0.65} className="shrink-0 text-green-500" aria-hidden />
        )}
      </button>
    </li>
  )
}
