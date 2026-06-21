import type { RecipeOutput } from "../api/generated/types.gen"
import { useCookMode } from "../contexts/CookModeContext"
import { IngredientsSection } from "./IngredientsSection"
import { InstructionsSection } from "./InstructionsSection"
import { NutritionPanel } from "./NutritionPanel"
import { RecipeFooter } from "./RecipeFooter"
import { RecipeTabsMobile } from "./RecipeTabsMobile"
import { Badge } from "./ui"

function DescriptionRow({ recipe }: { recipe: RecipeOutput }) {
  const hasDescription = !!recipe.description
  const hasCategories = (recipe.recipeCategory?.length ?? 0) > 0
  const hasTags = (recipe.tags?.length ?? 0) > 0
  const hasNutrition = !!recipe.settings?.showNutrition && !!recipe.nutrition

  if (!hasDescription && !hasCategories && !hasTags && !hasNutrition) return null

  return (
    <div className="mx-auto hidden max-w-6xl items-start gap-10 px-6 pt-8 pb-2 md:flex md:px-10">
      <div className="min-w-0 flex-1">
        {hasDescription && (
          <p className="mb-4 text-gray-300 text-lg leading-relaxed">{recipe.description}</p>
        )}
        {(hasCategories || hasTags) && (
          <div className="flex flex-wrap gap-2">
            {recipe.recipeCategory?.map(c => (
              <Badge key={c.id ?? c.slug ?? c.name} variant="category">
                {c.name}
              </Badge>
            ))}
            {recipe.tags?.map(t => (
              <Badge key={t.id ?? t.slug ?? t.name} variant="tag">
                {t.name}
              </Badge>
            ))}
          </div>
        )}
      </div>
      {hasNutrition && (
        <div className="w-96 shrink-0">
          <NutritionPanel nutrition={recipe.nutrition} settings={recipe.settings} />
        </div>
      )}
    </div>
  )
}

function RecipeColumns({
  recipe,
  img,
  isCookMode,
  hasIngredients,
  hasInstructions,
}: {
  recipe: RecipeOutput
  img?: string | null
  isCookMode: boolean
  hasIngredients: boolean
  hasInstructions: boolean
}) {
  return (
    <div
      className={
        isCookMode
          ? "grid h-full grid-cols-1 lg:grid-cols-2 lg:divide-x lg:divide-gray-800"
          : "mx-auto hidden max-w-6xl grid-cols-1 gap-0 px-6 py-10 md:grid md:grid-cols-2 md:divide-x md:divide-gray-800 md:px-10"
      }
    >
      {hasIngredients && (
        <IngredientsSection
          ingredients={recipe.recipeIngredient ?? []}
          recipeId={recipe.id ?? ""}
          defaultServings={recipe.recipeServings}
          steps={recipe.recipeInstructions ?? []}
        />
      )}
      {hasInstructions && (
        <InstructionsSection
          steps={recipe.recipeInstructions ?? []}
          recipeId={recipe.id ?? ""}
          img={img}
        />
      )}
    </div>
  )
}

export function RecipeBody({ recipe, img }: { recipe: RecipeOutput; img?: string | null }) {
  const { isCookMode } = useCookMode()
  const hasIngredients = (recipe.recipeIngredient?.length ?? 0) > 0
  const hasInstructions = (recipe.recipeInstructions?.length ?? 0) > 0

  return (
    <div className={isCookMode ? "h-full" : "bg-gray-950"}>
      {!isCookMode && <DescriptionRow recipe={recipe} />}
      {!isCookMode && (
        <div className="md:hidden">
          <NutritionPanel nutrition={recipe.nutrition} settings={recipe.settings} />
        </div>
      )}
      {hasIngredients || hasInstructions ? (
        <>
          {!isCookMode && (
            <RecipeTabsMobile
              ingredients={recipe.recipeIngredient ?? []}
              instructions={recipe.recipeInstructions ?? []}
              description={recipe.description}
              categories={recipe.recipeCategory}
              tags={recipe.tags}
              recipeId={recipe.id ?? ""}
              defaultServings={recipe.recipeServings}
              img={img}
            />
          )}
          <RecipeColumns
            recipe={recipe}
            img={img}
            isCookMode={isCookMode}
            hasIngredients={hasIngredients}
            hasInstructions={hasInstructions}
          />
        </>
      ) : null}
      {!isCookMode && <RecipeFooter recipe={recipe} />}
    </div>
  )
}
