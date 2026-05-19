import { createFileRoute, redirect } from "@tanstack/react-router"
import { configureApiClient } from "../api/client"
import { getOneApiRecipesSlugGet } from "../api/generated/sdk.gen"
import { recipeUrl, tryDecodeRecipeId } from "../utils/recipe"

export const Route = createFileRoute("/recipes/$slug")({
  loader: async ({ params }) => {
    configureApiClient()
    const lookup = tryDecodeRecipeId(params.slug) ?? params.slug
    const r = await getOneApiRecipesSlugGet({ path: { slug: lookup } })
    if (!r.data?.id || !r.data?.slug) throw new Error("Recipe not found")
    throw redirect({ to: recipeUrl(r.data.id, r.data.slug), statusCode: 301 })
  },
  component: () => null,
})
