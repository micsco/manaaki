import type { RecipeIngredientOutput } from "../api/generated/types.gen"
import { useCookMode } from "../contexts/CookModeContext"
import { groupByTitle } from "../utils/recipe"
import { IngredientCheckbox } from "./IngredientCheckbox"

function IngredientItem({
  ing,
  index,
  recipeId,
}: {
  ing: RecipeIngredientOutput
  index: number
  recipeId: string
}) {
  const text = ing.display || ing.originalText || ""
  return (
    <IngredientCheckbox
      ingredient={text}
      recipeId={recipeId}
      ingredientIndex={index}
      quantity={ing.quantity}
      unit={ing.unit}
      food={ing.food}
      note={ing.note}
    />
  )
}

export function IngredientsSection({
  ingredients,
  recipeId,
}: {
  ingredients: RecipeIngredientOutput[]
  recipeId: string
}) {
  const { isCookMode } = useCookMode()
  const groups = groupByTitle(ingredients)
  const hasSections = groups.some(g => g.title !== null)

  const className = isCookMode ? "overflow-y-auto px-4 py-6 lg:pr-10" : "pr-0 md:pr-10"

  return (
    <section className={className}>
      <h2 className="mb-6 font-sans font-semibold text-gray-500 text-xs uppercase tracking-widest">
        Ingredients
      </h2>
      {hasSections ? (
        <div>
          {groups.map((group, gi) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: group index is stable; groups are derived from ingredient list with no stable section ID
            <section key={`${recipeId}-ing-group-${gi}`}>
              {group.title && (
                <h3 className="mt-8 pb-2 font-semibold text-gray-200 text-sm uppercase tracking-wide first:mt-0">
                  {group.title}
                </h3>
              )}
              <ul>
                {group.items.map(({ item: ing, index }) => (
                  <IngredientItem
                    key={ing.referenceId ?? `${recipeId}-${index}`}
                    ing={ing}
                    index={index}
                    recipeId={recipeId}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <ul>
          {ingredients.map((ing, i) => (
            <IngredientItem
              key={ing.referenceId ?? `${recipeId}-${i}`}
              ing={ing}
              index={i}
              recipeId={recipeId}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
