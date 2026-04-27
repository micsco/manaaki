import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import { getOneApiRecipesSlugGet } from "../api/generated/sdk.gen"
import type { RecipeOutput, RecipeStep } from "../api/generated/types.gen"
import { CookModeToggle } from "../components/CookModeToggle"
import { KitchenLayout } from "../components/KitchenLayout"
import { StepByStepCooking } from "../components/StepByStepCooking"
import { Badge, Button } from "../components/ui"
import { useCookMode } from "../contexts/CookModeContext"

export const Route = createFileRoute("/recipes/$slug")({
  loader: ({ params }) =>
    getOneApiRecipesSlugGet({ path: { slug: params.slug } }).then(r => r.data!),
  component: RecipeDetail,
})

function recipeImageUrl(recipe: RecipeOutput): string | null {
  if (!recipe.id || !recipe.image) return null
  return `/api/media/recipes/${recipe.id}/images/original.webp`
}

function formatTime(t: string | null | undefined): string | null {
  if (!t) return null
  // ISO 8601 duration — just show the raw value for now
  return t.replace("PT", "").replace("H", "h ").replace("M", "m").trim()
}

function InstructionStep({ step, index }: { step: RecipeStep; index: number }) {
  return (
    <li className="relative pl-8 pb-6 last:pb-0">
      {step.title && <h3 className="font-semibold text-gray-200 mb-2">{step.title}</h3>}
      <div className="absolute left-0 top-0 w-6 h-6 bg-orange-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
        {index + 1}
      </div>
      <p className="text-gray-300 leading-relaxed">{step.text}</p>
    </li>
  )
}

function RecipeDetail() {
  const recipe = Route.useLoaderData()
  const { isCookMode } = useCookMode()
  const [showStepByStep, setShowStepByStep] = useState(false)
  const img = recipeImageUrl(recipe)

  const prepTime = formatTime(recipe.prepTime)
  const cookTime = formatTime(recipe.cookTime)
  const totalTime = formatTime(recipe.totalTime)

  const hasIngredients = (recipe.recipeIngredient?.length ?? 0) > 0
  const hasInstructions = (recipe.recipeInstructions?.length ?? 0) > 0

  // In cook mode and step-by-step view
  if (isCookMode && showStepByStep && hasInstructions) {
    return (
      <KitchenLayout
        title={recipe.name ?? undefined}
        backButton={
          <Button onClick={() => setShowStepByStep(false)} variant="ghost" size="sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Recipe
          </Button>
        }
      >
        <StepByStepCooking
          steps={recipe.recipeInstructions!}
          onComplete={() => setShowStepByStep(false)}
        />
      </KitchenLayout>
    )
  }

  const backButton = (
    <Link
      to="/recipes"
      className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 font-medium"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      All recipes
    </Link>
  )

  const actions = (
    <div className="flex items-center gap-3">
      {hasInstructions && (
        <Button
          onClick={() => setShowStepByStep(true)}
          size="sm"
          className="bg-green-600 hover:bg-green-700"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {isCookMode ? "Start Cooking" : "Step-by-Step"}
        </Button>
      )}
      <CookModeToggle />
    </div>
  )

  return (
    <KitchenLayout
      title={isCookMode ? (recipe.name ?? undefined) : undefined}
      backButton={isCookMode ? backButton : undefined}
      actions={isCookMode ? actions : undefined}
    >
      {!isCookMode && <div className="mb-6">{backButton}</div>}

      <div>
        {/* Tablet-optimized layout with side-by-side image and info */}
        <div className={`grid gap-8 mb-8 ${isCookMode ? "grid-cols-1" : "tablet:grid-cols-3"}`}>
          {img && (
            <div className={isCookMode ? "tablet:col-span-1" : "tablet:col-span-1"}>
              <img
                className={`w-full object-cover rounded-lg shadow-lg ${isCookMode ? "h-48" : "h-64"}`}
                src={img}
                alt={recipe.name ?? ""}
                width={800}
                height={400}
              />
            </div>
          )}

          <div className={isCookMode ? "" : "tablet:col-span-2"}>
            <h1 className={`font-bold text-gray-100 mb-4 ${isCookMode ? "text-2xl" : "text-4xl"}`}>
              {recipe.name}
            </h1>

            {recipe.description && (
              <p
                className={`text-gray-300 mb-6 leading-relaxed ${isCookMode ? "text-base" : "text-lg"}`}
              >
                {recipe.description}
              </p>
            )}

            {/* Cook mode controls */}
            {!isCookMode && <div className="mb-6">{actions}</div>}
          </div>
        </div>

        {/* Recipe metadata - horizontal layout for tablets */}
        <dl
          className={`grid gap-4 mb-6 p-4 bg-gray-900 rounded-lg ${
            isCookMode
              ? "grid-cols-2 sm:grid-cols-4"
              : "grid-cols-2 md:grid-cols-4 tablet:grid-cols-5"
          }`}
        >
          {prepTime && (
            <>
              <dt className="text-sm font-medium text-gray-500">Prep</dt>
              <dd className="text-sm text-gray-200 font-semibold">{prepTime}</dd>
            </>
          )}
          {cookTime && (
            <>
              <dt className="text-sm font-medium text-gray-500">Cook</dt>
              <dd className="text-sm text-gray-200 font-semibold">{cookTime}</dd>
            </>
          )}
          {totalTime && (
            <>
              <dt className="text-sm font-medium text-gray-500">Total</dt>
              <dd className="text-sm text-gray-200 font-semibold">{totalTime}</dd>
            </>
          )}
          {recipe.recipeServings != null && recipe.recipeServings > 0 && (
            <>
              <dt className="text-sm font-medium text-gray-500">Servings</dt>
              <dd className="text-sm text-gray-200 font-semibold">
                {recipe.recipeServings}
                {recipe.recipeYield ? ` ${recipe.recipeYield}` : ""}
              </dd>
            </>
          )}
          {recipe.rating != null && (
            <>
              <dt className="text-sm font-medium text-gray-500">Rating</dt>
              <dd className="text-sm text-gray-200 font-semibold">
                <span className="text-yellow-500">{"★".repeat(Math.round(recipe.rating))}</span>
                <span className="text-gray-600">{"☆".repeat(5 - Math.round(recipe.rating))}</span>
              </dd>
            </>
          )}
        </dl>

        {recipe.recipeCategory?.length || recipe.tags?.length ? (
          <div className="flex flex-wrap gap-2 mb-8">
            {recipe.recipeCategory?.map(c => (
              <Badge key={c.id ?? c.slug} variant="category">
                {c.name}
              </Badge>
            ))}
            {recipe.tags?.map(t => (
              <Badge key={t.id ?? t.slug} variant="tag">
                {t.name}
              </Badge>
            ))}
          </div>
        ) : null}

        {/* Tablet-optimized main content layout */}
        <div
          className={`gap-8 mb-8 ${
            isCookMode
              ? "space-y-8"
              : "grid md:grid-cols-2 tablet:grid-cols-3 tablet-lg:grid-cols-4"
          }`}
        >
          {hasIngredients && (
            <section
              className={`bg-gray-900 rounded-lg p-6 ${
                isCookMode ? "" : "md:col-span-1 tablet:col-span-1"
              }`}
            >
              <h2
                className={`font-semibold text-gray-100 mb-4 ${isCookMode ? "text-lg" : "text-xl"}`}
              >
                Ingredients
              </h2>
              <ul className={`space-y-2 ${isCookMode ? "cook-mode-text" : ""}`}>
                {recipe.recipeIngredient!.map((ing, i) => {
                  if (ing.title) {
                    return (
                      <li
                        key={i}
                        className={`font-semibold text-gray-200 mt-4 mb-2 ${isCookMode ? "text-lg" : ""}`}
                      >
                        {ing.title}
                      </li>
                    )
                  }
                  return (
                    <li
                      key={i}
                      className={`text-gray-300 ${isCookMode ? "text-base leading-relaxed" : ""}`}
                    >
                      {ing.display || ing.originalText}
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {hasInstructions && (
            <section
              className={`bg-gray-900 rounded-lg p-6 ${
                isCookMode ? "" : "md:col-span-1 tablet:col-span-2 tablet-lg:col-span-3"
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className={`font-semibold text-gray-100 ${isCookMode ? "text-lg" : "text-xl"}`}>
                  Instructions
                </h2>
                {!isCookMode && (
                  <Button
                    onClick={() => setShowStepByStep(true)}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Step-by-Step
                  </Button>
                )}
              </div>
              <ol className={isCookMode ? "cook-mode-text" : ""}>
                {recipe.recipeInstructions!.map((step, i) => (
                  <InstructionStep key={step.id ?? i} step={step} index={i} />
                ))}
              </ol>
            </section>
          )}
        </div>

        {recipe.notes && recipe.notes.length > 0 && (
          <section className="bg-gray-900 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-100 mb-4">Notes</h2>
            {recipe.notes.map((note, i) => (
              <div key={i} className="mb-4 last:mb-0">
                {note.title && <h3 className="font-semibold text-gray-200 mb-2">{note.title}</h3>}
                <p className="text-gray-300">{note.text}</p>
              </div>
            ))}
          </section>
        )}

        {recipe.orgURL && (
          <p className="text-sm text-gray-400">
            Source:{" "}
            <a
              href={recipe.orgURL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-400 hover:text-orange-300 underline"
            >
              {recipe.orgURL}
            </a>
          </p>
        )}
      </div>
    </KitchenLayout>
  )
}
