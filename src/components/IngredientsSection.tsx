import type { RecipeIngredientOutput } from "../api/generated/types.gen"
import { useCookMode } from "../contexts/CookModeContext"
import { IngredientCheckbox } from "./IngredientCheckbox"

interface IngredientGroup {
  title: string | null
  items: { ing: RecipeIngredientOutput; index: number }[]
}

function groupIngredients(ingredients: RecipeIngredientOutput[]): IngredientGroup[] {
  const groups: IngredientGroup[] = []
  let current: IngredientGroup = { title: null, items: [] }

  for (let i = 0; i < ingredients.length; i++) {
    const ing = ingredients[i]
    if (ing.title) {
      if (current.items.length > 0 || current.title !== null) {
        groups.push(current)
      }
      current = { title: ing.title, items: [] }
    } else {
      current.items.push({ ing, index: i })
    }
  }
  if (current.items.length > 0 || current.title !== null) {
    groups.push(current)
  }

  return groups
}

export function IngredientsSection({
  ingredients,
  recipeId,
}: {
  ingredients: RecipeIngredientOutput[]
  recipeId: string
}) {
  const { isCookMode } = useCookMode()
  const groups = groupIngredients(ingredients)
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
                {group.items.map(({ ing, index }) => {
                  const text = ing.display || ing.originalText || ""
                  return (
                    <IngredientCheckbox
                      key={ing.referenceId ?? `${recipeId}-${index}`}
                      ingredient={text}
                      recipeId={recipeId}
                      ingredientIndex={index}
                      quantity={ing.quantity}
                      unit={ing.unit}
                      food={ing.food}
                      note={ing.note}
                    />
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <ul>
          {ingredients.map((ing, i) => {
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
      )}
    </section>
  )
}
