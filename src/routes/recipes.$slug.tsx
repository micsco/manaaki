import { createFileRoute, Link } from "@tanstack/react-router"
import { ChevronLeft } from "lucide-react"
import { getOneApiRecipesSlugGet } from "../api/generated/sdk.gen"
import type { RecipeOutput } from "../api/generated/types.gen"
import { CookModeToggle } from "../components/CookModeToggle"
import { KitchenLayout } from "../components/KitchenLayout"
import { RecipeBody } from "../components/RecipeBody"
import { RecipeHeader } from "../components/RecipeHeader"
import { useCookMode } from "../contexts/CookModeContext"
import { recipeImageUrl } from "../utils/recipe"

async function loader({ params }: { params: { slug: string } }): Promise<RecipeOutput> {
  const r = await getOneApiRecipesSlugGet({ path: { slug: params.slug } })
  if (!r.data) throw new Error("Recipe not found")
  return r.data
}

export const Route = createFileRoute("/recipes/$slug")({
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.name ?? "Recipe"} · What's Cookin'` }],
  }),
  loader,
  component: RecipeDetail,
})

function RecipeDetail() {
  const recipe = Route.useLoaderData()
  const { isCookMode } = useCookMode()
  const img = recipeImageUrl(recipe.id, "original")
  const backButton = (
    <Link
      to="/recipes"
      className="inline-flex items-center gap-2 font-medium text-orange-400 hover:text-orange-300"
    >
      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      All recipes
    </Link>
  )
  const actions = <CookModeToggle />

  return (
    <KitchenLayout title={recipe.name ?? undefined} backButton={backButton} actions={actions}>
      {!isCookMode && <RecipeHeader recipe={recipe} img={img} actions={actions} />}
      <RecipeBody recipe={recipe} />
    </KitchenLayout>
  )
}
