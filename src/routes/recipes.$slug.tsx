import { createFileRoute, Link } from "@tanstack/react-router"
import { ChevronLeft, CirclePlay } from "lucide-react"
import { useQueryState } from "nuqs"
import { getOneApiRecipesSlugGet } from "../api/generated/sdk.gen"
import { CookModeToggle } from "../components/CookModeToggle"
import { KitchenLayout } from "../components/KitchenLayout"
import { RecipeBody } from "../components/RecipeBody"
import { RecipeHeader } from "../components/RecipeHeader"
import { StepByStepCooking } from "../components/StepByStepCooking"
import { Button } from "../components/ui"
import { useCookMode } from "../contexts/CookModeContext"
import { recipeImageUrl } from "../utils/recipe"

export const Route = createFileRoute("/recipes/$slug")({
  loader: async ({ params }) => {
    const r = await getOneApiRecipesSlugGet({ path: { slug: params.slug } })
    if (!r.data) throw new Error("Recipe not found")
    return r.data
  },
  component: RecipeDetail,
})

function BackToRecipesLink() {
  return (
    <Link
      to="/recipes"
      className="inline-flex items-center gap-2 font-medium text-orange-400 hover:text-orange-300"
    >
      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      All recipes
    </Link>
  )
}

function StartCookingButton({ onClick }: { onClick: () => void }) {
  const { isCookMode } = useCookMode()
  return (
    <Button onClick={onClick} size="sm" className="bg-green-600 hover:bg-green-700">
      <CirclePlay className="h-4 w-4" aria-hidden="true" />
      {isCookMode ? "Start Cooking" : "Step-by-Step"}
    </Button>
  )
}

function RecipeDetail() {
  const recipe = Route.useLoaderData()
  const { isCookMode } = useCookMode()
  const [showStepByStep, setShowStepByStep] = useQueryState("step", {
    parse: (value: string) => value === "true",
    serialize: (value: boolean) => value.toString(),
    defaultValue: false,
    clearOnDefault: true,
  })

  const hasInstructions = (recipe.recipeInstructions?.length ?? 0) > 0

  // Step-by-step cooking overlay (cook mode only)
  if (isCookMode && showStepByStep && hasInstructions) {
    return (
      <KitchenLayout
        title={recipe.name ?? undefined}
        backButton={
          <Button onClick={() => setShowStepByStep(false)} variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Back to Recipe
          </Button>
        }
      >
        <StepByStepCooking
          steps={recipe.recipeInstructions ?? []}
          onComplete={() => setShowStepByStep(false)}
        />
      </KitchenLayout>
    )
  }

  const img = recipeImageUrl(recipe.id, "original")
  const backButton = <BackToRecipesLink />
  const actions = (
    <div className="flex items-center gap-3">
      {hasInstructions && <StartCookingButton onClick={() => setShowStepByStep(true)} />}
      <CookModeToggle />
    </div>
  )

  return (
    <KitchenLayout title={recipe.name ?? undefined} backButton={backButton} actions={actions}>
      {!isCookMode && <RecipeHeader recipe={recipe} img={img} actions={actions} />}
      <RecipeBody recipe={recipe} onStartStepByStep={() => setShowStepByStep(true)} />
    </KitchenLayout>
  )
}
