import { Link, createFileRoute } from '@tanstack/react-router'
import { getAllApiRecipesGet } from '../api/generated/sdk.gen'
import type { RecipeSummary } from '../api/generated/types.gen'

export const Route = createFileRoute('/recipes')({
  loader: () =>
    getAllApiRecipesGet({ query: { perPage: 50, orderBy: 'name', orderDirection: 'asc' } }).then(
      (r) => r.data!,
    ),
  component: RecipeList,
})

function recipeImageUrl(recipe: RecipeSummary): string | null {
  if (!recipe.id || !recipe.image) return null
  return `/api/media/recipes/${recipe.id}/images/min-original.webp`
}

function RecipeCard({ recipe }: { recipe: RecipeSummary }) {
  const img = recipeImageUrl(recipe)
  return (
    <Link to="/recipes/$slug" params={{ slug: recipe.slug! }} className="recipe-card">
      {img ? (
        <img src={img} alt={recipe.name ?? ''} width={240} height={160} />
      ) : (
        <div className="recipe-card__placeholder" aria-hidden="true" />
      )}
      <div className="recipe-card__body">
        <h2 className="recipe-card__name">{recipe.name}</h2>
        {recipe.description && (
          <p className="recipe-card__description">{recipe.description}</p>
        )}
        <div className="recipe-card__meta">
          {recipe.totalTime && <span>{recipe.totalTime}</span>}
          {recipe.rating != null && <span>{'★'.repeat(Math.round(recipe.rating))}</span>}
        </div>
      </div>
    </Link>
  )
}

function RecipeList() {
  const data = Route.useLoaderData()

  return (
    <main>
      <h1>Recipes</h1>
      <p>{data.total ?? data.items.length} recipes</p>
      <div className="recipe-grid">
        {data.items.map((recipe) => (
          <RecipeCard key={recipe.id ?? recipe.slug} recipe={recipe} />
        ))}
      </div>
    </main>
  )
}
