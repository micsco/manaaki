import { usePostHog } from "@posthog/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import type { RecipeSummary } from "../api/generated/types.gen"
import { RecipeCardInfoBadges, RecipeCardToolBadges } from "../components/RecipeCardMeta"
import { Card } from "../components/ui"
import { recipeListQueryOptions } from "../hooks/useRecipeList"
import { recipeImageUrl, recipeUrl } from "../utils/recipe"

export const Route = createFileRoute("/recipes/")({
  head: () => ({
    meta: [{ title: "Recipes · What's Cookin'" }],
  }),
  loader: ({ context: { queryClient } }) =>
    void queryClient.ensureQueryData(recipeListQueryOptions),
  component: RecipeList,
})

function RecipeImage({ recipe }: { recipe: RecipeSummary }) {
  const [failed, setFailed] = useState(false)
  const img = recipeImageUrl(recipe.id, "min-original", recipe.image)

  return (
    <div className="relative h-48 w-full">
      {img && !failed ? (
        <img
          src={img}
          alt={recipe.name ?? ""}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="h-full w-full bg-gray-800" aria-hidden="true" />
      )}
      <div className="absolute top-0 right-0 p-2">
        <RecipeCardToolBadges recipe={recipe} />
      </div>
      <div className="absolute right-0 bottom-0 left-0 bg-gradient-to-t from-black/70 to-transparent px-3 pt-6 pb-2">
        <RecipeCardInfoBadges recipe={recipe} />
      </div>
    </div>
  )
}

function RecipeCard({ recipe }: { recipe: RecipeSummary }) {
  const posthog = usePostHog()

  return (
    <Card hover className="overflow-hidden">
      {recipe.id && recipe.slug ? (
        <Link
          to={recipeUrl(recipe.id, recipe.slug)}
          className="block rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-950"
          onClick={() =>
            posthog.capture("recipe_card_clicked", {
              recipe_id: recipe.id,
              recipe_name: recipe.name,
              recipe_rating: recipe.rating,
              recipe_total_time: recipe.totalTime,
            })
          }
        >
          <RecipeImage recipe={recipe} />
          <div className="p-4">
            <h3 className="line-clamp-2 font-semibold text-gray-100 text-lg">{recipe.name}</h3>
          </div>
        </Link>
      ) : (
        <div className="p-4">
          <h3 className="line-clamp-2 font-semibold text-gray-100 text-lg">{recipe.name}</h3>
        </div>
      )}
    </Card>
  )
}

function RecipeList() {
  const { data } = useQuery(recipeListQueryOptions)
  const recipes = data ?? []

  return (
    <main className="min-h-screen bg-gray-950">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <h1 className="mb-2 font-bold text-4xl text-gray-100">Recipes</h1>
          <p className="text-gray-400 text-lg">{recipes.length} recipes</p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {recipes.map(recipe => (
            <RecipeCard key={recipe.id ?? recipe.slug} recipe={recipe} />
          ))}
        </div>
      </div>
    </main>
  )
}
