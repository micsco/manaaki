import { mdiCheck } from "@mdi/js"
import { usePostHog } from "@posthog/react"
import { type MouseEvent, useCallback, useMemo } from "react"

import type { RecipeStep } from "../api/generated/types.gen"
import { useSessionStorage } from "../hooks/useSessionStorage"
import { stepStorageKey } from "../utils/recipe"
import { parseStepSegments } from "../utils/timer"
import { Icon } from "./Icon"
import { StepTimerChip } from "./StepTimerChip"

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

  const handleButtonClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation()
      handleToggle()
    },
    [handleToggle]
  )

  const stepNumber = index + 1
  const summary = step.summary?.trim() || null

  const ariaLabel = summary
    ? `Step ${stepNumber}: ${summary}${isChecked ? ", completed" : ""}`
    : `Step ${stepNumber}${isChecked ? ", completed" : ""}`

  const segments = useMemo(() => {
    const parsed = parseStepSegments(step.text)
    return parsed.map((segment, segIdx) => ({
      ...segment,
      key: `${recipeId}-step-${index}-${segIdx}-${segment.value.slice(0, 10)}`,
      timerId: `${recipeId}-step-${index}-${segIdx}`,
    }))
  }, [step.text, recipeId, index])

  const timerLabel = summary ? `Step ${stepNumber}: ${summary}` : `Step ${stepNumber}`

  return (
    <li className={`group border-t border-gray-800 last:border-b ${className}`}>
      <div
        className="flex w-full cursor-pointer items-baseline gap-3 py-3 text-left transition-colors hover:text-gray-200"
        onClick={handleToggle}
        role="presentation"
      >
        <button
          type="button"
          className={`shrink-0 cursor-pointer font-semibold tabular-nums transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 ${
            isChecked ? "text-gray-600" : "text-orange-500"
          }`}
          onClick={handleButtonClick}
          aria-label={ariaLabel}
        >
          {stepNumber}.
        </button>
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
          {segments.map(segment => {
            if (segment.type === "text") {
              return <span key={segment.key}>{segment.value}</span>
            }

            return (
              <span key={segment.key} className="mx-1 inline-block">
                <StepTimerChip
                  timerId={segment.timerId}
                  recipeId={recipeId}
                  stepIndex={index}
                  label={`${timerLabel} (${segment.value})`}
                  rawDurationText={segment.value}
                  seconds={segment.seconds}
                />
              </span>
            )
          })}
        </span>
        {isChecked && (
          <Icon path={mdiCheck} size={0.65} className="shrink-0 text-green-500" aria-hidden />
        )}
      </div>
    </li>
  )
}
