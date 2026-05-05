import type { RecipeIngredientOutput } from "../api/generated/types.gen"
import { useCookMode } from "../contexts/CookModeContext"
import { useSessionStorage } from "../hooks/useSessionStorage"
import { groupByTitle, scaleQuantity, servingsStorageKey } from "../utils/recipe"
import { IngredientCheckbox } from "./IngredientCheckbox"
import { ServingsSelect } from "./ui/ServingsSelect"

function IngredientItem({
  ing,
  index,
  recipeId,
  scale,
}: {
  ing: RecipeIngredientOutput
  index: number
  recipeId: string
  scale: number
}) {
  const text = ing.display || ing.originalText || ""
  return (
    <IngredientCheckbox
      ingredient={text}
      recipeId={recipeId}
      ingredientIndex={index}
      quantity={scaleQuantity(ing.quantity, scale)}
      unit={ing.unit}
      food={ing.food}
      note={ing.note}
    />
  )
}

export function IngredientsSection({
  ingredients,
  recipeId,
  defaultServings,
}: {
  ingredients: RecipeIngredientOutput[]
  recipeId: string
  defaultServings?: number | null
}) {
  const { isCookMode } = useCookMode()
  const groups = groupByTitle(ingredients)
  const hasSections = groups.some(g => g.title !== null)

  const hasServings = defaultServings != null && defaultServings > 0
  const [servings, setServings] = useSessionStorage(
    servingsStorageKey(recipeId),
    hasServings ? (defaultServings as number) : 1
  )
  const scale = hasServings ? servings / (defaultServings as number) : 1

  const className = isCookMode ? "overflow-y-auto px-4 py-6 lg:pr-10" : "pr-0 md:pr-10"

  return (
    <section className={className}>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-sans font-semibold text-gray-500 text-xs uppercase tracking-widest">
          Ingredients
        </h2>
        {hasServings && (
          <ServingsSelect
            value={servings}
            onChange={v => {
              if (v != null) setServings(v)
            }}
          />
        )}
      </div>
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
                    scale={scale}
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
              scale={scale}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
