import { mdiCheck, mdiChevronDown } from "@mdi/js"
import { type ChangeEvent, useCallback, useState } from "react"
import type { RecipeStep } from "../api/generated/types.gen"
import { useSessionStorage } from "../hooks/useSessionStorage"
import { Icon } from "./Icon"

interface InstructionStepProps {
  step: RecipeStep
  index: number
  recipeId: string
  className?: string
  hideTitle?: boolean
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
          ? "border-2 border-green-500 bg-green-600 text-white hover:border-green-400"
          : "border-2 border-orange-500 bg-orange-600 text-white hover:border-orange-400"
      }`}
    >
      {isChecked ? <Icon path={mdiCheck} size={0.65} aria-hidden={true} /> : stepNumber}
    </div>
  )
}

function StepContent({
  step,
  isChecked,
  isExpanded,
  onToggleExpanded,
  hideTitle,
}: {
  step: RecipeStep
  isChecked: boolean
  isExpanded: boolean
  onToggleExpanded: (e: React.MouseEvent) => void
  hideTitle?: boolean
}) {
  return (
    <div className="min-w-0 flex-1">
      {step.title && !hideTitle && (
        <h3
          className={`mb-2 font-semibold transition-all duration-300 ${
            isChecked ? "text-gray-400 line-through" : "text-gray-200"
          }`}
        >
          {step.title}
        </h3>
      )}

      <div
        className={`overflow-hidden transition-all duration-300 ${isChecked && !isExpanded ? "max-h-0 opacity-0" : "max-h-96 opacity-100"}`}
      >
        <p
          className={`leading-relaxed transition-all duration-300 ${isChecked ? "text-gray-500" : "text-gray-300"}`}
        >
          {step.text}
        </p>
      </div>

      {isChecked && (
        <button
          type="button"
          onClick={onToggleExpanded}
          className="mt-2 flex items-center gap-1 text-orange-400 text-xs transition-colors duration-200 hover:text-orange-300"
          aria-label={isExpanded ? "Collapse step" : "Expand step"}
        >
          <Icon
            path={mdiChevronDown}
            size={0.55}
            className={`transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
            aria-hidden={true}
          />
          {isExpanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  )
}

/**
 * Instruction step component with checkbox completion and collapse functionality.
 * When checked, the step collapses to a single line with a ticked number indicator.
 */
export function InstructionStep({
  step,
  index,
  recipeId,
  className = "",
  hideTitle = false,
}: InstructionStepProps) {
  // Create a unique key for this step in this recipe
  const storageKey = `recipe-${recipeId}-step-${index}`

  const [isChecked, setIsChecked] = useSessionStorage(storageKey, false)
  const [isExpanded, setIsExpanded] = useState(!isChecked) // Start collapsed if checked

  const handleToggle = useCallback(() => {
    const newCheckedState = !isChecked
    setIsChecked(newCheckedState)
    // Auto-collapse when checked, expand when unchecked
    setIsExpanded(!newCheckedState)
  }, [isChecked, setIsChecked])

  const handleCheckboxChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation()
      const newCheckedState = e.target.checked
      setIsChecked(newCheckedState)
      // Auto-collapse when checked, expand when unchecked
      setIsExpanded(!newCheckedState)
    },
    [setIsChecked]
  )

  const toggleExpanded = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (isChecked) {
        setIsExpanded(!isExpanded)
      }
    },
    [isChecked, isExpanded]
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
        className={`flex w-full cursor-pointer items-start gap-4 p-4 text-left transition-all duration-300 ${
          isChecked && !isExpanded ? "py-3" : ""
        }`}
        onClick={handleToggle}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            handleToggle()
          }
        }}
      >
        {/* Step number / checkbox */}
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

        <StepContent
          step={step}
          isChecked={isChecked}
          isExpanded={isExpanded}
          onToggleExpanded={toggleExpanded}
          hideTitle={hideTitle}
        />
      </button>
    </li>
  )
}
