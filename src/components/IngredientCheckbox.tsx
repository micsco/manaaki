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

  const handleCheckboxChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation()
    setIsChecked(e.target.checked)
  }, [setIsChecked])

  return (
    <li 
      className={`group flex items-start gap-3 cursor-pointer hover:bg-gray-800/30 rounded-lg p-3 -mx-3 transition-all duration-200 ${className}`}
      onClick={handleToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
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
          className="h-5 w-5 rounded border-2 border-gray-600 bg-gray-700 text-orange-600 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-950 cursor-pointer transition-all duration-200 hover:border-orange-500"
          onClick={(e) => e.stopPropagation()}
        />
        {isChecked && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}
      </div>
      <span 
        className={`flex-1 select-none transition-all duration-200 leading-relaxed ${
          isChecked 
            ? "line-through text-gray-500 opacity-75" 
            : "text-gray-300 group-hover:text-gray-200"
        }`}
      >
        {children || ingredient}
      </span>
    </li>
  )
}