import { mdiCheck } from "@mdi/js"
import { type ChangeEvent, type ReactNode, useCallback } from "react"
import type {
  CreateIngredientFood,
  CreateIngredientUnit,
  IngredientFoodOutput,
  IngredientUnitOutput,
} from "../api/generated/types.gen"
import { useSessionStorage } from "../hooks/useSessionStorage"
import { formatQuantity } from "../utils/recipe"
import { Icon } from "./Icon"

interface IngredientCheckboxProps {
  ingredient: string
  recipeId: string
  ingredientIndex: number
  /** Structured ingredient data — when provided, renders a visual hierarchy. */
  quantity?: number | null
  unit?: IngredientUnitOutput | CreateIngredientUnit | null
  food?: IngredientFoodOutput | CreateIngredientFood | null
  note?: string | null
  children?: ReactNode
  className?: string
}

/** Returns the best display label for a unit, respecting abbreviation preferences. */
function unitLabel(
  unit: IngredientUnitOutput | CreateIngredientUnit,
  quantity: number | null | undefined
): string {
  const isPlural = quantity != null && quantity !== 1

  // IngredientUnitOutput has useAbbreviation; CreateIngredientUnit may too
  const useAbbr = "useAbbreviation" in unit ? unit.useAbbreviation : false
  if (useAbbr) {
    const abbr =
      isPlural && "pluralAbbreviation" in unit ? unit.pluralAbbreviation : unit.abbreviation
    if (abbr) return abbr
  }

  const plural = "pluralName" in unit ? unit.pluralName : undefined
  return (isPlural && plural) || unit.name
}

interface StructuredIngredientProps {
  quantity?: number | null
  unit?: IngredientUnitOutput | CreateIngredientUnit | null
  food?: IngredientFoodOutput | CreateIngredientFood | null
  note?: string | null
  isChecked: boolean
}

/**
 * Renders a structured ingredient with visual hierarchy:
 * quantity+unit in lighter muted text, food name prominent, note below in small muted text.
 */
function StructuredIngredient({
  quantity,
  unit,
  food,
  note,
  isChecked,
}: StructuredIngredientProps) {
  const checkedClass = "text-gray-500 line-through opacity-75"
  return (
    <span
      className={`flex-1 select-none transition-all duration-200 ${isChecked ? checkedClass : ""}`}
    >
      {/* Line 1: quantity + unit (muted) + food name (prominent) */}
      <span className="flex flex-wrap items-baseline gap-x-1.5 leading-relaxed">
        {(quantity != null || unit != null) && (
          <span
            className={`font-normal ${isChecked ? "" : "text-gray-400 group-hover:text-gray-300"}`}
          >
            {formatQuantity(quantity)}
            {unit && <span className="ml-1">{unitLabel(unit, quantity)}</span>}
          </span>
        )}
        {food && (
          <span
            className={`font-medium ${isChecked ? "" : "text-gray-100 group-hover:text-gray-50"}`}
          >
            {food.name}
          </span>
        )}
      </span>
      {/* Line 2: note (smaller, more muted) */}
      {note && (
        <span
          className={`mt-0.5 block text-sm leading-snug ${isChecked ? "" : "text-gray-500 group-hover:text-gray-400"}`}
        >
          {note}
        </span>
      )}
    </span>
  )
}

/**
 * Checkbox component for recipe ingredients with session storage persistence.
 * Toggles when clicking either the checkbox or the ingredient text.
 *
 * When `quantity`, `unit`, `food`, or `note` props are provided, renders a
 * visual hierarchy matching Mealie's style: quantity+unit in lighter text,
 * food name prominent, and note in smaller muted text below.
 */
export function IngredientCheckbox({
  ingredient,
  recipeId,
  ingredientIndex,
  quantity,
  unit,
  food,
  note,
  children,
  className = "",
}: IngredientCheckboxProps) {
  // Create a unique key for this ingredient in this recipe
  const storageKey = `recipe-${recipeId}-ingredient-${ingredientIndex}`

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

  const hasStructuredData = food != null || unit != null || quantity != null
  const checkedTextClass = "text-gray-500 line-through opacity-75"
  const uncheckedTextClass = "text-gray-300 group-hover:text-gray-200"

  return (
    <li
      className={`group -mx-2 flex cursor-pointer items-start gap-3 rounded-lg px-2 py-1.5 transition-all duration-200 hover:bg-gray-800/30 ${className}`}
      onClick={handleToggle}
      onKeyDown={e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          handleToggle()
        }
      }}
    >
      <div className="relative mt-0.5">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={handleCheckboxChange}
          className="h-5 w-5 cursor-pointer rounded border-2 border-gray-600 bg-gray-700 text-orange-600 transition-all duration-200 hover:border-orange-500 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-950"
          onClick={e => e.stopPropagation()}
        />
        {isChecked && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <Icon path={mdiCheck} size={0.5} className="text-white" aria-hidden={true} />
          </div>
        )}
      </div>

      {hasStructuredData ? (
        <StructuredIngredient
          quantity={quantity}
          unit={unit}
          food={food}
          note={note}
          isChecked={isChecked}
        />
      ) : (
        <span
          className={`flex-1 select-none leading-relaxed transition-all duration-200 ${
            isChecked ? checkedTextClass : uncheckedTextClass
          }`}
        >
          {children || ingredient}
        </span>
      )}
    </li>
  )
}
