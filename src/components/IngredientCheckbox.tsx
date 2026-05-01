import { mdiCheck } from "@mdi/js"
import { usePostHog } from "@posthog/react"
import { useCallback } from "react"
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
  quantity?: number | null
  unit?: IngredientUnitOutput | CreateIngredientUnit | null
  food?: IngredientFoodOutput | CreateIngredientFood | null
  note?: string | null
  className?: string
}

function unitLabel(
  unit: IngredientUnitOutput | CreateIngredientUnit,
  quantity: number | null | undefined
): string {
  const isPlural = quantity != null && quantity !== 1

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

function StructuredIngredient({
  quantity,
  unit,
  food,
  note,
  isChecked,
}: StructuredIngredientProps) {
  const checkedClass = "text-gray-500 line-through opacity-75"
  const hasQuantity = quantity != null && quantity !== 0
  const noteOnly = food == null && !hasQuantity && unit == null
  return (
    <span
      className={`min-w-0 flex-1 select-none transition-all duration-200 ${isChecked ? checkedClass : ""}`}
    >
      <span className="flex flex-wrap items-baseline gap-x-1.5 leading-relaxed">
        {(hasQuantity || unit != null) && (
          <span className={`font-normal ${isChecked ? "" : "text-gray-400"}`}>
            {formatQuantity(quantity)}
            {unit && <span className="ml-1">{unitLabel(unit, quantity)}</span>}
          </span>
        )}
        {food && (
          <span className={`font-medium ${isChecked ? "" : "text-gray-100"}`}>{food.name}</span>
        )}
        {note && (
          <span
            className={
              noteOnly
                ? `font-normal ${isChecked ? "" : "text-gray-300"}`
                : `text-sm leading-none ${isChecked ? "" : "text-gray-500"}`
            }
          >
            {note}
          </span>
        )}
      </span>
    </span>
  )
}

export function IngredientCheckbox({
  ingredient,
  recipeId,
  ingredientIndex,
  quantity,
  unit,
  food,
  note,
  className = "",
}: IngredientCheckboxProps) {
  const storageKey = `recipe-${recipeId}-ingredient-${ingredientIndex}`
  const [isChecked, setIsChecked] = useSessionStorage(storageKey, false)
  const posthog = usePostHog()

  const handleToggle = useCallback(() => {
    const nextChecked = !isChecked
    posthog.capture(nextChecked ? "ingredient_checked" : "ingredient_unchecked", {
      recipe_id: recipeId,
      ingredient_index: ingredientIndex,
      ingredient: ingredient,
    })
    setIsChecked(nextChecked)
  }, [isChecked, posthog, recipeId, ingredientIndex, ingredient, setIsChecked])

  const hasStructuredData =
    food != null || unit != null || (quantity != null && quantity !== 0) || note != null

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
        aria-label={`${ingredient}${isChecked ? ", checked" : ""}`}
      >
        <span
          className={`shrink-0 select-none font-semibold transition-colors ${
            isChecked ? "text-gray-600" : "text-orange-500"
          }`}
        >
          •
        </span>
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
            className={`min-w-0 flex-1 select-none leading-relaxed transition-colors ${
              isChecked ? "text-gray-500 line-through opacity-75" : "text-gray-300"
            }`}
          >
            {ingredient}
          </span>
        )}
        {isChecked && (
          <Icon
            path={mdiCheck}
            size={0.65}
            className="shrink-0 self-center text-green-500"
            aria-hidden
          />
        )}
      </button>
    </li>
  )
}
