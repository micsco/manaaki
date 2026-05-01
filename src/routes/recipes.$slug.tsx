import { mdiChevronLeft } from "@mdi/js"
import { usePostHog } from "@posthog/react"
import { useHotkey } from "@tanstack/react-hotkeys"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"
import { getOneApiRecipesSlugGet } from "../api/generated/sdk.gen"
import type { RecipeOutput } from "../api/generated/types.gen"
import { Icon } from "../components/Icon"
import { KitchenLayout } from "../components/KitchenLayout"
import { RecipeBody } from "../components/RecipeBody"
import { RecipeHeader } from "../components/RecipeHeader"
import { useCookMode } from "../contexts/CookModeContext"
import { useRecipeNav } from "../hooks/useRecipeNav"
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
  const img = recipeImageUrl(recipe.id, "original", recipe.image)
  const navigate = useNavigate()
  const { prevSlug, nextSlug } = useRecipeNav(recipe.slug ?? "")
  const posthog = usePostHog()

  useEffect(() => {
    posthog.capture("recipe_viewed", {
      recipe_id: recipe.id,
      recipe_slug: recipe.slug,
      recipe_name: recipe.name,
      recipe_rating: recipe.rating,
      recipe_total_time: recipe.totalTime,
      has_image: !!img,
    })
  }, [recipe.id, recipe.slug, recipe.name, recipe.rating, recipe.totalTime, img, posthog])

  useHotkey("ArrowLeft", () => {
    if (prevSlug) {
      posthog.capture("recipe_navigated", {
        direction: "prev",
        method: "keyboard",
        from_slug: recipe.slug,
        to_slug: prevSlug,
      })
      navigate({ to: "/recipes/$slug", params: { slug: prevSlug } })
    }
  })

  useHotkey("ArrowRight", () => {
    if (nextSlug) {
      posthog.capture("recipe_navigated", {
        direction: "next",
        method: "keyboard",
        from_slug: recipe.slug,
        to_slug: nextSlug,
      })
      navigate({ to: "/recipes/$slug", params: { slug: nextSlug } })
    }
  })

  const cookModeBackButton = (
    <Link
      to="/recipes"
      className="inline-flex items-center gap-2 font-medium text-orange-400 hover:text-orange-300"
    >
      <Icon path={mdiChevronLeft} size={0.75} aria-hidden={true} />
      All recipes
    </Link>
  )

  return (
    <KitchenLayout title={recipe.name ?? undefined} backButton={cookModeBackButton}>
      {!isCookMode && (
        <RecipeHeader recipe={recipe} img={img} prevSlug={prevSlug} nextSlug={nextSlug} />
      )}
      <RecipeBody recipe={recipe} />
    </KitchenLayout>
  )
}
