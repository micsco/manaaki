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

  if (isCookMode) {
    return (
      <section className="rounded-lg bg-gray-900 p-6">
        <h2 className="mb-4 font-semibold text-gray-100 text-lg">Ingredients</h2>
        <ul className="cook-mode-text space-y-1">
          {ingredients.map((ing, i) => {
            if (ing.title) {
              return (
                <li key={ing.title} className="mt-4 mb-2 font-semibold text-gray-200 text-lg">
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
                className="text-base leading-relaxed"
              >
                {ing.display || ing.originalText}
              </IngredientCheckbox>
            )
          })}
        </ul>
      </section>
    )
  }

  return (
    <section className="pr-0 md:pr-10">
      <h2 className="mb-6 font-sans font-semibold text-gray-500 text-xs uppercase tracking-widest">
        Ingredients
      </h2>
      <ul className="space-y-2">
        {ingredients.map((ing, i) => {
          if (ing.title) {
            return (
              <li
                key={ing.title}
                className="mt-6 mb-2 font-semibold text-gray-200 text-sm uppercase tracking-wide"
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
            >
              {ing.display || ing.originalText}
            </IngredientCheckbox>
          )
        })}
      </ul>
    </section>
  )
}
