import { createFileRoute, Link } from "@tanstack/react-router"
import { getAllApiRecipesGet } from "../api/generated/sdk.gen"
import type { RecipeSummary } from "../api/generated/types.gen"
import { Badge, Card } from "../components/ui"

export const Route = createFileRoute("/recipes/")({
  loader: async () => {
    const response = await getAllApiRecipesGet({
      query: { perPage: 50, orderBy: "name", orderDirection: "asc" },
    })
    if (!response.data) {
      throw new Error("Failed to load recipes")
    }
    return response.data
  },
  component: RecipeList,
})

function recipeImageUrl(recipe: RecipeSummary): string | null {
  if (!recipe.id || !recipe.image) return null
  return `/api/media/recipes/${recipe.id}/images/min-original.webp`
}

function RecipeCard({ recipe }: { recipe: RecipeSummary }) {
  const img = recipeImageUrl(recipe)
  return (
    <Card hover className="overflow-hidden">
      {recipe.slug ? (
        <Link
          to="/recipes/$slug"
          params={{ slug: recipe.slug }}
          className="block rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-950"
        >
          {img ? (
            <img
              src={img}
              alt={recipe.name ?? ""}
              className="h-48 w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="h-48 w-full bg-gray-800" aria-hidden="true" />
          )}
          <div className="p-4">
            <h3 className="mb-2 line-clamp-2 font-semibold text-gray-100 text-lg">{recipe.name}</h3>
            {recipe.description && (
              <p className="mb-3 line-clamp-2 text-gray-400 text-sm">{recipe.description}</p>
            )}
            <div className="flex items-center gap-3 text-gray-500 text-sm">
              {recipe.totalTime && (
                <Badge variant="tag" className="flex items-center gap-1">
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-label="Clock"
                  >
                    <title>Cooking time</title>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {recipe.totalTime}
                </Badge>
              )}
              {recipe.rating != null && (
                <Badge variant="rating" className="flex items-center gap-1">
                  <svg
                    className="h-3 w-3"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    aria-label="Star rating"
                  >
                    <title>Rating</title>
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
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
