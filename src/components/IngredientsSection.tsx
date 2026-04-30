import type { RecipeIngredientOutput } from "../api/generated/types.gen"
import { useCookMode } from "../contexts/CookModeContext"
import { IngredientCheckbox } from "./IngredientCheckbox"

export function IngredientsSection({
  ingredients,
  recipeId,
}: {
  ingredients: RecipeIngredientOutput[]
  recipeId: string
}) {
  const { isCookMode } = useCookMode()
  return (
    <section className="rounded-lg bg-gray-900 p-6">
      <h2 className={`mb-4 font-semibold text-gray-100 ${isCookMode ? "text-lg" : "text-xl"}`}>
        Ingredients
      </h2>
      <ul className={`space-y-1 ${isCookMode ? "cook-mode-text" : ""}`}>
        {ingredients.map((ing, i) => {
          if (ing.title) {
            return (
              <li
                key={ing.title}
                className={`mt-4 mb-2 font-semibold text-gray-200 ${isCookMode ? "text-lg" : ""}`}
              >
                {ing.title}
              </li>
            )
          }
          const text = ing.display || ing.originalText || ""
          return (
            <IngredientCheckbox
              key={text || i}
              ingredient={text}
              recipeId={recipeId}
              ingredientIndex={i}
              quantity={ing.quantity}
              unit={ing.unit}
              food={ing.food}
              note={ing.note}
              className={isCookMode ? "text-base leading-relaxed" : ""}
            >
              {ing.display || ing.originalText}
            </IngredientCheckbox>
          )
        })}
      </ul>
    </section>
  )
}
