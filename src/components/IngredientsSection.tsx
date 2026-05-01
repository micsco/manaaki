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

  const className = isCookMode ? "overflow-y-auto px-4 py-6 lg:pr-10" : "pr-0 md:pr-10"

  return (
    <section className={className}>
      <h2 className="mb-6 font-sans font-semibold text-gray-500 text-xs uppercase tracking-widest">
        Ingredients
      </h2>
      <ul>
        {ingredients.map((ing, i) => {
          if (ing.title) {
            return (
              <li
                key={ing.referenceId ?? `${recipeId}-title-${i}`}
                className="mt-6 mb-2 font-semibold text-gray-200 text-sm uppercase tracking-wide"
              >
                {ing.title}
              </li>
            )
          }
          const text = ing.display || ing.originalText || ""
          return (
            <IngredientCheckbox
              key={ing.referenceId ?? `${recipeId}-${i}`}
              ingredient={text}
              recipeId={recipeId}
              ingredientIndex={i}
              quantity={ing.quantity}
              unit={ing.unit}
              food={ing.food}
              note={ing.note}
            />
          )
        })}
      </ul>
    </section>
  )
}
