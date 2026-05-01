import type { RecipeOutput } from "../api/generated/types.gen"
import { useCookMode } from "../contexts/CookModeContext"
import { IngredientsSection } from "./IngredientsSection"
import { InstructionsSection } from "./InstructionsSection"
import { RecipeNotes } from "./RecipeNotes"

function RecipeFooter({ recipe }: { recipe: RecipeOutput }) {
  return (
    <div className="mx-auto max-w-6xl px-6 pb-12 md:px-10">
      <RecipeNotes notes={recipe.notes ?? []} />
      {recipe.orgURL && (
        <p className="mt-6 text-gray-500 text-sm">
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

export function RecipeBody({ recipe }: { recipe: RecipeOutput }) {
  const { isCookMode } = useCookMode()
  const hasIngredients = (recipe.recipeIngredient?.length ?? 0) > 0
  const hasInstructions = (recipe.recipeInstructions?.length ?? 0) > 0

  return (
    <div className={isCookMode ? "h-full" : "bg-gray-950"}>
      {hasIngredients || hasInstructions ? (
        <div
          className={
            isCookMode
              ? "grid h-full grid-cols-1 lg:grid-cols-2 lg:divide-x lg:divide-gray-800"
              : "mx-auto grid max-w-6xl grid-cols-1 gap-0 px-6 py-10 md:grid-cols-2 md:divide-x md:divide-gray-800 md:px-10"
          }
        >
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
      {!isCookMode && <RecipeFooter recipe={recipe} />}
    </div>
  )
}
