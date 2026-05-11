import { mdiCheck } from "@mdi/js"
import { usePostHog } from "@posthog/react"
import { useCallback } from "react"
import type { RecipeStep } from "../api/generated/types.gen"
import { useSessionStorage } from "../hooks/useSessionStorage"
import { stepStorageKey } from "../utils/recipe"
import { Icon } from "./Icon"

interface InstructionStepProps {
  step: RecipeStep
  index: number
  recipeId: string
  className?: string
}

export function InstructionStep({ step, index, recipeId, className = "" }: InstructionStepProps) {
  const [isChecked, setIsChecked] = useSessionStorage(stepStorageKey(recipeId, index), false)
  const posthog = usePostHog()

  const handleToggle = useCallback(() => {
    const nextChecked = !isChecked
    posthog.capture(nextChecked ? "recipe_step_completed" : "recipe_step_uncompleted", {
      recipe_id: recipeId,
      step_number: index + 1,
    })
    setIsChecked(nextChecked)
  }, [isChecked, posthog, recipeId, index, setIsChecked])

  const stepNumber = index + 1
  const summary = step.summary?.trim() || null

  const ariaLabel = summary
    ? `Step ${stepNumber}: ${summary}${isChecked ? ", completed" : ""}`
    : `Step ${stepNumber}${isChecked ? ", completed" : ""}`

  return (
    <li className={`group border-gray-800 border-t last:border-b ${className}`}>
      <button
        type="button"
        className="flex w-full cursor-pointer items-baseline gap-3 py-3 text-left transition-colors hover:text-gray-200"
        onClick={handleToggle}
        aria-label={ariaLabel}
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
          {summary && (
            <>
              <strong>{summary}</strong>
              {" \u2014 "}
            </>
          )}
          {step.text}
        </span>
        {isChecked && (
          <Icon path={mdiCheck} size={0.65} className="shrink-0 text-green-500" aria-hidden />
        )}
      </button>
    </li>
  )
}
