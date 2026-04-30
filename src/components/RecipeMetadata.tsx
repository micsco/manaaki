import type { RecipeOutput } from "../api/generated/types.gen"
import { formatTime } from "../utils/recipe"

export function RecipeMetadata({ recipe }: { recipe: RecipeOutput }) {
  const prepTime = formatTime(recipe.prepTime)
  const cookTime = formatTime(recipe.cookTime)
  const totalTime = formatTime(recipe.totalTime)

  const hasMetadata =
    prepTime ||
    cookTime ||
    totalTime ||
    (recipe.recipeServings != null && recipe.recipeServings > 0) ||
    recipe.rating != null
  if (!hasMetadata) return null

  return (
    <dl className="mb-6 grid grid-cols-2 gap-4 rounded-lg bg-gray-900 p-4 md:grid-cols-4">
      {prepTime && (
        <>
          <dt className="font-medium text-gray-500 text-sm">Prep</dt>
          <dd className="font-semibold text-gray-200 text-sm">{prepTime}</dd>
        </>
      )}
      {cookTime && (
        <>
          <dt className="font-medium text-gray-500 text-sm">Cook</dt>
          <dd className="font-semibold text-gray-200 text-sm">{cookTime}</dd>
        </>
      )}
      {totalTime && (
        <>
          <dt className="font-medium text-gray-500 text-sm">Total</dt>
          <dd className="font-semibold text-gray-200 text-sm">{totalTime}</dd>
        </>
      )}
      {recipe.recipeServings != null && recipe.recipeServings > 0 && (
        <>
          <dt className="font-medium text-gray-500 text-sm">Servings</dt>
          <dd className="font-semibold text-gray-200 text-sm">
            {recipe.recipeServings}
            {recipe.recipeYield ? ` ${recipe.recipeYield}` : ""}
          </dd>
        </>
      )}
      {recipe.rating != null && (
        <>
          <dt className="font-medium text-gray-500 text-sm">Rating</dt>
          <dd className="font-semibold text-gray-200 text-sm">
            <span className="text-yellow-500">{"★".repeat(Math.round(recipe.rating))}</span>
            <span className="text-gray-600">{"☆".repeat(5 - Math.round(recipe.rating))}</span>
          </dd>
        </>
      )}
    </dl>
  )
}
