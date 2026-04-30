import { Check } from "lucide-react"
import { type ChangeEvent, type ReactNode, useCallback } from "react"
import { useSessionStorage } from "../hooks/useSessionStorage"

interface IngredientCheckboxProps {
  ingredient: string
  recipeId: string
  ingredientIndex: number
  children?: ReactNode
  className?: string
}

/**
 * Checkbox component for recipe ingredients with session storage persistence.
 * Toggles when clicking either the checkbox or the ingredient text.
 */
export function IngredientCheckbox({
  ingredient,
  recipeId,
  ingredientIndex,
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

  return (
    <li
      className={`group -mx-3 flex cursor-pointer items-start gap-3 rounded-lg p-3 transition-all duration-200 hover:bg-gray-800/30 ${className}`}
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
            <Check className="h-3 w-3 text-white" aria-hidden="true" />
          </div>
        )}
      </div>
      <span
        className={`flex-1 select-none leading-relaxed transition-all duration-200 ${
          isChecked
            ? "text-gray-500 line-through opacity-75"
            : "text-gray-300 group-hover:text-gray-200"
        }`}
      >
        {children || ingredient}
      </span>
    </li>
  )
}
