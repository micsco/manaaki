import type { RecipeOutput } from "../api/generated/types.gen"
import { useCookMode } from "../contexts/CookModeContext"
import { IngredientsSection } from "./IngredientsSection"
import { InstructionsSection } from "./InstructionsSection"
import { RecipeNotes } from "./RecipeNotes"

export function RecipeBody({ recipe }: { recipe: RecipeOutput }) {
  const { isCookMode } = useCookMode()
  const hasIngredients = (recipe.recipeIngredient?.length ?? 0) > 0
  const hasInstructions = (recipe.recipeInstructions?.length ?? 0) > 0
  return (
    <div>
      {hasIngredients || hasInstructions ? (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {hasIngredients && (
            <IngredientsSection
              ingredients={recipe.recipeIngredient ?? []}
              recipeId={recipe.id ?? ""}
            />
          )}
          {hasInstructions && (
            <InstructionsSection
              steps={recipe.recipeInstructions ?? []}
              recipeId={recipe.id ?? ""}
            />
          )}
        </div>
      ) : null}
      {!isCookMode && <RecipeNotes notes={recipe.notes ?? []} />}
      {!isCookMode && recipe.orgURL && (
        <p className="mt-8 text-gray-400 text-sm">
          Source:{" "}
          <a
            href={recipe.orgURL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-400 underline hover:text-orange-300"
          >
            {recipe.orgURL}
          </a>
        </p>
      )}
    </div>
  )
}
