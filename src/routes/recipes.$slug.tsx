import { createFileRoute, Link } from "@tanstack/react-router"
import { useQueryState } from "nuqs"
import { getOneApiRecipesSlugGet } from "../api/generated/sdk.gen"
import type { RecipeIngredientOutput, RecipeOutput, RecipeStep } from "../api/generated/types.gen"
import { CookModeToggle } from "../components/CookModeToggle"
import { IngredientCheckbox } from "../components/IngredientCheckbox"
import { InstructionStep } from "../components/InstructionStep"
import { KitchenLayout } from "../components/KitchenLayout"
import { StepByStepCooking } from "../components/StepByStepCooking"
import { Badge, Button } from "../components/ui"
import { useCookMode } from "../contexts/CookModeContext"

export const Route = createFileRoute("/recipes/$slug")({
  loader: async ({ params }) => {
    const r = await getOneApiRecipesSlugGet({ path: { slug: params.slug } })
    if (!r.data) throw new Error("Recipe not found")
    return r.data
  },
  component: RecipeDetail,
})

function recipeImageUrl(recipe: RecipeOutput): string | null {
  if (!recipe.id) return null
  return `/api/media/recipes/${recipe.id}/images/original.webp`
}

function formatTime(t: string | null | undefined): string | null {
  if (!t) return null
  // ISO 8601 duration — just show the raw value for now
  return t.replace("PT", "").replace("H", "h ").replace("M", "m").trim()
}

function RecipeMetadata({ recipe }: { recipe: RecipeOutput }) {
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

function IngredientsSection({
  ingredients,
  recipeId,
  isCookMode,
}: {
  ingredients: RecipeIngredientOutput[]
  recipeId: string
  isCookMode: boolean
}) {
  return (
    <section className="rounded-lg bg-gray-900 p-6">
      <h2 className={`mb-4 font-semibold text-gray-100 ${isCookMode ? "text-lg" : "text-xl"}`}>
        Ingredients
      </h2>
      <ul className={`space-y-1 ${isCookMode ? "cook-mode-text" : ""}`}>
        {ingredients.map((ing, i) => {
          if (ing.title) {
            return (
              <li
                key={ing.title}
                className={`mt-4 mb-2 font-semibold text-gray-200 ${isCookMode ? "text-lg" : ""}`}
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
              className={isCookMode ? "text-base leading-relaxed" : ""}
            >
              {ing.display || ing.originalText}
            </IngredientCheckbox>
          )
        })}
      </ul>
    </section>
  )
}

function InstructionsSection({
  steps,
  recipeId,
  isCookMode,
  onStartStepByStep,
}: {
  steps: RecipeStep[]
  recipeId: string
  isCookMode: boolean
  onStartStepByStep: () => void
}) {
  return (
    <section className="rounded-lg bg-gray-900 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className={`font-semibold text-gray-100 ${isCookMode ? "text-lg" : "text-xl"}`}>
          Instructions
        </h2>
        {!isCookMode && (
          <Button onClick={onStartStepByStep} size="sm" className="bg-green-600 hover:bg-green-700">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
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
      <ol className={`space-y-3 ${isCookMode ? "cook-mode-text" : ""}`}>
        {steps.map((step, i) => (
          <InstructionStep
            key={step.id ?? step.text ?? i}
            step={step}
            index={i}
            recipeId={recipeId}
            isCookMode={isCookMode}
          />
        ))}
      </ol>
    </section>
  )
}

function RecipeNormalHeader({
  recipe,
  img,
  actions,
}: {
  recipe: RecipeOutput
  img: string | null
  actions: React.ReactNode
}) {
  return (
    <>
      {img && (
        <div className="mb-8">
          <img
            className="h-64 w-full rounded-lg object-cover shadow-lg"
            src={img}
            alt={recipe.name ?? ""}
            width={800}
            height={400}
          />
        </div>
      )}
      <h1 className="mb-4 font-bold text-4xl text-gray-100">{recipe.name}</h1>
      {recipe.description && (
        <p className="mb-6 text-gray-300 text-lg leading-relaxed">{recipe.description}</p>
      )}
      <RecipeMetadata recipe={recipe} />
      {recipe.recipeCategory?.length || recipe.tags?.length ? (
        <div className="mb-8 flex flex-wrap gap-2">
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
      <div className="mb-8">{actions}</div>
    </>
  )
}

function BackToRecipesLink() {
  return (
    <Link
      to="/recipes"
      className="inline-flex items-center gap-2 font-medium text-orange-400 hover:text-orange-300"
    >
      <svg
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      All recipes
    </Link>
  )
}

function StartCookingButton({ isCookMode, onClick }: { isCookMode: boolean; onClick: () => void }) {
  return (
    <Button onClick={onClick} size="sm" className="bg-green-600 hover:bg-green-700">
      <svg
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
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
  )
}

function RecipeNotes({ notes }: { notes: NonNullable<RecipeOutput["notes"]> }) {
  if (notes.length === 0) return null
  return (
    <section className="mt-8 rounded-lg bg-gray-900 p-6">
      <h2 className="mb-4 font-semibold text-gray-100 text-xl">Notes</h2>
      {notes.map((note, i) => (
        <div key={note.title ?? i} className="mb-4 last:mb-0">
          {note.title && <h3 className="mb-2 font-semibold text-gray-200">{note.title}</h3>}
          <p className="text-gray-300">{note.text}</p>
        </div>
      ))}
    </section>
  )
}

function StepByStepView({ recipe, onExit }: { recipe: RecipeOutput; onExit: () => void }) {
  return (
    <KitchenLayout
      title={recipe.name ?? undefined}
      backButton={
        <Button onClick={onExit} variant="ghost" size="sm">
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
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
      <StepByStepCooking steps={recipe.recipeInstructions ?? []} onComplete={onExit} />
    </KitchenLayout>
  )
}

function RecipeBody({
  recipe,
  isCookMode,
  onStartStepByStep,
}: {
  recipe: RecipeOutput
  isCookMode: boolean
  onStartStepByStep: () => void
}) {
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
              isCookMode={isCookMode}
            />
          )}
          {hasInstructions && (
            <InstructionsSection
              steps={recipe.recipeInstructions ?? []}
              recipeId={recipe.id ?? ""}
              isCookMode={isCookMode}
              onStartStepByStep={onStartStepByStep}
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

function RecipeDetail() {
  const recipe = Route.useLoaderData()
  const { isCookMode } = useCookMode()
  const [showStepByStep, setShowStepByStep] = useQueryState("step", {
    // Parse URL param to boolean
    parse: (value: string) => value === "true",
    // Serialize boolean to URL param
    serialize: (value: boolean) => value.toString(),
    // Default to false if not present
    defaultValue: false,
    // Clear the param when false to keep URLs clean
    clearOnDefault: true,
  })

  const hasInstructions = (recipe.recipeInstructions?.length ?? 0) > 0

  if (isCookMode && showStepByStep && hasInstructions) {
    return <StepByStepView recipe={recipe} onExit={() => setShowStepByStep(false)} />
  }

  const img = recipeImageUrl(recipe)
  const backButton = <BackToRecipesLink />
  const actions = (
    <div className="flex items-center gap-3">
      {hasInstructions && (
        <StartCookingButton isCookMode={isCookMode} onClick={() => setShowStepByStep(true)} />
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
      {!isCookMode && <RecipeNormalHeader recipe={recipe} img={img} actions={actions} />}
      <RecipeBody
        recipe={recipe}
        isCookMode={isCookMode}
        onStartStepByStep={() => setShowStepByStep(true)}
      />
    </KitchenLayout>
  )
}
