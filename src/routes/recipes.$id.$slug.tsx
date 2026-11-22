import { useHotkey } from "@tanstack/react-hotkeys"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"

import { configureApiClient } from "../api/client"
import { getOneApiRecipesSlugGet } from "../api/generated/sdk.gen"
import type { RecipeOutput } from "../api/generated/types.gen"
import { KitchenLayout } from "../components/KitchenLayout"
import { RecipeBody } from "../components/RecipeBody"
import { RecipeHeader } from "../components/RecipeHeader"
import { RecipeTransition, useDisplayedRecipe } from "../components/RecipeTransition"
import { usePostHog } from "../contexts/AnalyticsContext"
import { useCookMode } from "../contexts/CookModeContext"
import { useRecipeNav } from "../hooks/useRecipeNav"
import { recipeNavHotkeys } from "../lib/recipeHotkeys"
import { markRecipeNavigation } from "../lib/recipeTransition"
import { decodeRecipeId, recipeImageUrl, recipeTimes, recipeUrl } from "../utils/recipe"
import { isSavedFromElsewhere } from "../utils/recipeProvenance"
import { buildRecipeJsonLd } from "../utils/recipeStructuredData"

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
  server: {
    handlers: {
      GET: async ({ request, params, next }) => {
        const { handleRecipeMarkdownRequest } = await import("../server/discovery")
        return (await handleRecipeMarkdownRequest(request, params)) ?? next()
      },
    },
  },
  headers: () => ({ Vary: "Accept" }),
  head: ({ loaderData }) => {
    const title = `${loaderData?.name ?? "Recipe"} · Manaaki`
    const description = loaderData?.description || "Check out this recipe on Manaaki!"
    const host =
      typeof window !== "undefined"
        ? window.location.origin
        : globalThis.process?.env?.PUBLIC_ORIGIN ||
          globalThis.process?.env?.VITE_PUBLIC_APP_URL ||
          "https://manaaki.micsco.nz"

    const resolveAbsoluteUrl = (path: string | null | undefined): string => {
      if (!path) return ""
      if (path.startsWith("http://") || path.startsWith("https://")) return path
      return `${host.replace(/\/+$/, "")}${path}`
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
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:image", content: ogImage },
        { property: "og:url", content: ogUrl },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: ogImage },
        ...(loaderData && isSavedFromElsewhere(loaderData)
          ? [{ name: "robots", content: "noindex" }]
          : []),
        ...(loaderData ? [{ "script:ld+json": buildRecipeJsonLd(loaderData, host) }] : []),
      ],
      links: ogUrl
        ? [
            { rel: "canonical", href: ogUrl },
            {
              rel: "alternate",
              type: "text/markdown",
              href: `${ogUrl}.md`,
              title: `${loaderData?.name ?? "Recipe"} (Markdown)`,
            },
            { rel: "describedby", type: "text/plain", href: resolveAbsoluteUrl("/llms.txt") },
          ]
        : [],
    }
  },
  loader,
  component: RecipeDetail,
})

function RecipeDetail() {
  const recipe = useDisplayedRecipe(Route.useLoaderData())
  const { isCookMode } = useCookMode()
  const img = recipeImageUrl(recipe.id, "original", recipe.image)
  const navigate = useNavigate()
  const { prevRecipe, nextRecipe } = useRecipeNav(recipe.id ?? "")
  const posthog = usePostHog()
  const totalTime = recipeTimes(recipe).total

  useEffect(() => {
    posthog.capture("recipe_viewed", {
      recipe_id: recipe.id,
      recipe_name: recipe.name,
      recipe_rating: recipe.rating,
      recipe_total_time: totalTime,
      has_image: !!img,
    })
  }, [recipe.id, recipe.name, recipe.rating, totalTime, img, posthog])

  useHotkey(
    recipeNavHotkeys.prev,
    () => {
      if (!isCookMode && prevRecipe) {
        posthog.capture("recipe_navigated", {
          direction: "prev",
          method: "keyboard",
          from_recipe_id: recipe.id,
          from_recipe_name: recipe.name,
          to_recipe_id: prevRecipe.id,
          to_recipe_name: prevRecipe.name,
        })
        markRecipeNavigation(prevRecipe.id, "prev")
        void navigate({ to: recipeUrl(prevRecipe.id, prevRecipe.slug) })
      }
    },
    { enabled: !isCookMode && !!prevRecipe, meta: { name: "Previous recipe" } }
  )

  useHotkey(
    recipeNavHotkeys.next,
    () => {
      if (!isCookMode && nextRecipe) {
        posthog.capture("recipe_navigated", {
          direction: "next",
          method: "keyboard",
          from_recipe_id: recipe.id,
          from_recipe_name: recipe.name,
          to_recipe_id: nextRecipe.id,
          to_recipe_name: nextRecipe.name,
        })
        markRecipeNavigation(nextRecipe.id, "next")
        void navigate({ to: recipeUrl(nextRecipe.id, nextRecipe.slug) })
      }
    },
    { enabled: !isCookMode && !!nextRecipe, meta: { name: "Next recipe" } }
  )

  return (
    <RecipeTransition recipeId={recipe.id}>
      <KitchenLayout title={recipe.name ?? undefined}>
        {!isCookMode && (
          <RecipeHeader recipe={recipe} img={img} prevRecipe={prevRecipe} nextRecipe={nextRecipe} />
        )}
        <RecipeBody recipe={recipe} img={img} />
      </KitchenLayout>
    </RecipeTransition>
  )
}
