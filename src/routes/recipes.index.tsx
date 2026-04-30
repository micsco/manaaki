import { mdiStarCircleOutline, mdiTimerOutline } from "@mdi/js"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import { getAllApiRecipesGet } from "../api/generated/sdk.gen"
import type { RecipeSummary } from "../api/generated/types.gen"
import { Icon } from "../components/Icon"
import { Badge, Card } from "../components/ui"
import { recipeImageUrl } from "../utils/recipe"

export const Route = createFileRoute("/recipes/")({
  head: () => ({
    meta: [{ title: "Recipes · What's Cookin'" }],
  }),
  loader: async () => {
    const response = await getAllApiRecipesGet({
      query: { perPage: 50, orderBy: "dateAdded", orderDirection: "desc" },
    })
    if (!response.data) {
      throw new Error("Failed to load recipes")
    }
    return response.data
  },
  component: RecipeList,
})

function RecipeImage({ recipe }: { recipe: RecipeSummary }) {
  const [failed, setFailed] = useState(false)
  const img = recipeImageUrl(recipe.id, "min-original")
  if (!img || failed) return <div className="h-48 w-full bg-gray-800" aria-hidden="true" />
  return (
    <img
      src={img}
      alt={recipe.name ?? ""}
      className="h-48 w-full object-cover"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

function RecipeCard({ recipe }: { recipe: RecipeSummary }) {
  return (
    <Card hover className="overflow-hidden">
      {recipe.slug ? (
        <Link
          to="/recipes/$slug"
          params={{ slug: recipe.slug }}
          className="block rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-950"
        >
          <RecipeImage recipe={recipe} />
          <div className="p-4">
            <h3 className="mb-2 line-clamp-2 font-semibold text-gray-100 text-lg">{recipe.name}</h3>
            {recipe.description && (
              <p className="mb-3 line-clamp-2 text-gray-400 text-sm">{recipe.description}</p>
            )}
            <div className="flex items-center gap-3 text-gray-500 text-sm">
              {recipe.totalTime && (
                <Badge variant="tag" className="flex items-center gap-1">
                  <Icon path={mdiTimerOutline} size={0.55} aria-hidden={true} />
                  {recipe.totalTime}
                </Badge>
              )}
              {recipe.rating != null && (
                <Badge variant="rating" className="flex items-center gap-1">
                  <Icon path={mdiStarCircleOutline} size={0.55} aria-hidden={true} />
                  {recipe.rating.toFixed(1)}
                </Badge>
              )}
            </div>
          </div>
        </Link>
      ) : (
        <div className="p-4">
          <h3 className="mb-2 line-clamp-2 font-semibold text-gray-100 text-lg">{recipe.name}</h3>
          {recipe.description && (
            <p className="mb-3 line-clamp-2 text-gray-400 text-sm">{recipe.description}</p>
          )}
          <p className="text-gray-500 text-sm">No slug available</p>
        </div>
      )}
    </Card>
  )
}

function RecipeList() {
  const data = Route.useLoaderData()

  return (
    <main className="min-h-screen bg-gray-950">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <h1 className="mb-2 font-bold text-4xl text-gray-100">Recipes</h1>
          <p className="text-gray-400 text-lg">{data.total ?? data.items.length} recipes</p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.items.map(recipe => (
            <RecipeCard key={recipe.id ?? recipe.slug} recipe={recipe} />
          ))}
        </div>
      </div>
    </main>
  )
}
