import { mdiCheck } from "@mdi/js"
import { type ChangeEvent, useCallback } from "react"
import type { RecipeStep } from "../api/generated/types.gen"
import { useSessionStorage } from "../hooks/useSessionStorage"
import { Icon } from "./Icon"

interface InstructionStepProps {
  step: RecipeStep
  index: number
  recipeId: string
  className?: string
}

function StepNumberIndicator({
  isChecked,
  stepNumber,
}: {
  isChecked: boolean
  stepNumber: number
}) {
  return (
    <div
      className={`flex h-8 w-8 items-center justify-center rounded-full font-semibold text-sm transition-all duration-300 ${
        isChecked
          ? "border-2 border-green-500 bg-green-600 text-white"
          : "border-2 border-orange-500 bg-orange-600 text-white hover:border-orange-400"
      }`}
    >
      {isChecked ? <Icon path={mdiCheck} size={0.65} aria-hidden={true} /> : stepNumber}
    </div>
  )
}

export function InstructionStep({ step, index, recipeId, className = "" }: InstructionStepProps) {
  const storageKey = `recipe-${recipeId}-step-${index}`
  const [isChecked, setIsChecked] = useSessionStorage(storageKey, false)

  const handleToggle = useCallback(() => {
    setIsChecked(prev => !prev)
  }, [setIsChecked])

  const handleCheckboxChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation()
      setIsChecked(e.target.checked)
    },
    [setIsChecked]
  )

  const stepNumber = index + 1

  return (
    <li
      className={`group relative rounded-lg border border-gray-800 transition-all duration-300 ${
        isChecked ? "border-gray-700 bg-gray-800/30" : "bg-gray-900/50 hover:bg-gray-800/50"
      } ${className}`}
    >
      <button
        type="button"
        className="flex w-full cursor-pointer items-start gap-4 p-4 text-left"
        onClick={handleToggle}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            handleToggle()
          }
        }}
      >
        <div className="relative flex-shrink-0">
          <input
            type="checkbox"
            checked={isChecked}
            onChange={handleCheckboxChange}
            className="sr-only"
            aria-label={`Mark step ${stepNumber} as complete`}
          />
          <StepNumberIndicator isChecked={isChecked} stepNumber={stepNumber} />
        </div>

        <p
          className={`min-w-0 flex-1 leading-relaxed transition-all duration-300 ${
            isChecked ? "truncate text-gray-500 line-through" : "text-gray-300"
          }`}
        >
          {step.text}
        </p>
      </button>
    </li>
  )
}
