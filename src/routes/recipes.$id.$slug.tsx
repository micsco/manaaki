import { mdiChevronLeft } from "@mdi/js"
import { usePostHog } from "@posthog/react"
import { useHotkey } from "@tanstack/react-hotkeys"
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"
import { configureApiClient } from "../api/client"
import { getOneApiRecipesSlugGet } from "../api/generated/sdk.gen"
import type { RecipeOutput } from "../api/generated/types.gen"
import { Icon } from "../components/Icon"
import { KitchenLayout } from "../components/KitchenLayout"
import { RecipeBody } from "../components/RecipeBody"
import { RecipeHeader } from "../components/RecipeHeader"
import { useCookMode } from "../contexts/CookModeContext"
import { useRecipeNav } from "../hooks/useRecipeNav"
import { decodeRecipeId, recipeImageUrl, recipeUrl } from "../utils/recipe"

async function loader({ params }: { params: { id: string; slug: string } }): Promise<RecipeOutput> {
  configureApiClient()
  const uuid = decodeRecipeId(params.id)
  const r = await getOneApiRecipesSlugGet({ path: { slug: uuid } })
  if (!r.data) throw new Error("Recipe not found")

  const recipe = r.data
  if (recipe.id && recipe.slug && params.slug !== recipe.slug) {
    throw redirect({ to: recipeUrl(recipe.id, recipe.slug), statusCode: 301 })
  }

  return recipe
}

export const Route = createFileRoute("/recipes/$id/$slug")({
  head: ({ loaderData }) => {
    const title = `${loaderData?.name ?? "Recipe"} · Manaaki`
    const description = loaderData?.description || "Check out this recipe on Manaaki!"

    const resolveAbsoluteUrl = (path: string | null | undefined): string => {
      if (!path) return ""
      if (path.startsWith("http://") || path.startsWith("https://")) return path
      const host =
        typeof window !== "undefined"
          ? window.location.origin
          : globalThis.process?.env?.VITE_PUBLIC_APP_URL || "https://manaaki.micsco.nz"
      return `${host}${path}`
    }

    const imagePath = loaderData
      ? recipeImageUrl(loaderData.id, "min-original", loaderData.image)
      : ""
    const ogImage = resolveAbsoluteUrl(imagePath)

    const recipePath =
      loaderData?.id && loaderData.slug ? recipeUrl(loaderData.id, loaderData.slug) : ""
    const ogUrl = resolveAbsoluteUrl(recipePath)

    return {
      meta: [
        { title },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:image", content: ogImage },
        { property: "og:url", content: ogUrl },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: ogImage },
      ],
    }
  },
  loader,
  component: RecipeDetail,
})

function RecipeDetail() {
  const recipe = Route.useLoaderData()
  const { isCookMode } = useCookMode()
  const img = recipeImageUrl(recipe.id, "original", recipe.image)
  const navigate = useNavigate()
  const { prevRecipe, nextRecipe } = useRecipeNav(recipe.id ?? "")
  const posthog = usePostHog()

  useEffect(() => {
    posthog.capture("recipe_viewed", {
      recipe_id: recipe.id,
      recipe_name: recipe.name,
      recipe_rating: recipe.rating,
      recipe_total_time: recipe.totalTime,
      has_image: !!img,
    })
  }, [recipe.id, recipe.name, recipe.rating, recipe.totalTime, img, posthog])

  useHotkey("ArrowLeft", () => {
    if (prevRecipe) {
      posthog.capture("recipe_navigated", {
        direction: "prev",
        method: "keyboard",
        from_recipe_id: recipe.id,
        from_recipe_name: recipe.name,
        to_recipe_id: prevRecipe.id,
        to_recipe_name: prevRecipe.name,
      })
      navigate({ to: recipeUrl(prevRecipe.id, prevRecipe.slug) })
    }
  })

  useHotkey("ArrowRight", () => {
    if (nextRecipe) {
      posthog.capture("recipe_navigated", {
        direction: "next",
        method: "keyboard",
        from_recipe_id: recipe.id,
        from_recipe_name: recipe.name,
        to_recipe_id: nextRecipe.id,
        to_recipe_name: nextRecipe.name,
      })
      navigate({ to: recipeUrl(nextRecipe.id, nextRecipe.slug) })
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
        <RecipeHeader recipe={recipe} img={img} prevRecipe={prevRecipe} nextRecipe={nextRecipe} />
      )}
      <RecipeBody recipe={recipe} img={img} />
    </KitchenLayout>
  )
}
