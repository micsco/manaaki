import { Link, createFileRoute } from '@tanstack/react-router'
import { getOneApiRecipesSlugGet } from '../api/generated/sdk.gen'
import type { RecipeOutput, RecipeStep } from '../api/generated/types.gen'

export const Route = createFileRoute('/recipes/$slug')({
  loader: ({ params }) =>
    getOneApiRecipesSlugGet({ path: { slug: params.slug } }).then((r) => r.data!),
  component: RecipeDetail,
})

function recipeImageUrl(recipe: RecipeOutput): string | null {
  if (!recipe.id || !recipe.image) return null
  return `/api/media/recipes/${recipe.id}/images/original.webp`
}

function formatTime(t: string | null | undefined): string | null {
  if (!t) return null
  // ISO 8601 duration — just show the raw value for now
  return t.replace('PT', '').replace('H', 'h ').replace('M', 'm').trim()
}

function InstructionStep({ step, index }: { step: RecipeStep; index: number }) {
  return (
    <li className="instruction-step">
      {step.title && <h3 className="instruction-step__title">{step.title}</h3>}
      <div className="instruction-step__number">{index + 1}</div>
      <p className="instruction-step__text">{step.text}</p>
    </li>
  )
}

function RecipeDetail() {
  const recipe = Route.useLoaderData()
  const img = recipeImageUrl(recipe)

  const prepTime = formatTime(recipe.prepTime)
  const cookTime = formatTime(recipe.cookTime)
  const totalTime = formatTime(recipe.totalTime)

  const hasIngredients = (recipe.recipeIngredient?.length ?? 0) > 0
  const hasInstructions = (recipe.recipeInstructions?.length ?? 0) > 0

  return (
    <main className="recipe-detail">
      <nav>
        <Link to="/recipes">← All recipes</Link>
      </nav>

      {img && (
        <img
          className="recipe-detail__hero"
          src={img}
          alt={recipe.name ?? ''}
          width={800}
          height={400}
        />
      )}

      <h1 className="recipe-detail__name">{recipe.name}</h1>

      {recipe.description && (
        <p className="recipe-detail__description">{recipe.description}</p>
      )}

      <dl className="recipe-detail__meta">
        {prepTime && (
          <>
            <dt>Prep</dt>
            <dd>{prepTime}</dd>
          </>
        )}
        {cookTime && (
          <>
            <dt>Cook</dt>
            <dd>{cookTime}</dd>
          </>
        )}
        {totalTime && (
          <>
            <dt>Total</dt>
            <dd>{totalTime}</dd>
          </>
        )}
        {recipe.recipeServings != null && recipe.recipeServings > 0 && (
          <>
            <dt>Servings</dt>
            <dd>
              {recipe.recipeServings}
              {recipe.recipeYield ? ` ${recipe.recipeYield}` : ''}
            </dd>
          </>
        )}
        {recipe.rating != null && (
          <>
            <dt>Rating</dt>
            <dd>{'★'.repeat(Math.round(recipe.rating))}{'☆'.repeat(5 - Math.round(recipe.rating))}</dd>
          </>
        )}
      </dl>

      {(recipe.recipeCategory?.length || recipe.tags?.length) ? (
        <div className="recipe-detail__tags">
          {recipe.recipeCategory?.map((c) => (
            <span key={c.id ?? c.slug} className="tag tag--category">{c.name}</span>
          ))}
          {recipe.tags?.map((t) => (
            <span key={t.id ?? t.slug} className="tag tag--tag">{t.name}</span>
          ))}
        </div>
      ) : null}

      <div className="recipe-detail__body">
        {hasIngredients && (
          <section className="recipe-detail__ingredients">
            <h2>Ingredients</h2>
            <ul>
              {recipe.recipeIngredient!.map((ing, i) => {
                if (ing.title) {
                  return <li key={i} className="ingredient-section-title">{ing.title}</li>
                }
                return <li key={i}>{ing.display || ing.originalText}</li>
              })}
            </ul>
          </section>
        )}

        {hasInstructions && (
          <section className="recipe-detail__instructions">
            <h2>Instructions</h2>
            <ol>
              {recipe.recipeInstructions!.map((step, i) => (
                <InstructionStep key={step.id ?? i} step={step} index={i} />
              ))}
            </ol>
          </section>
        )}
      </div>

      {recipe.notes && recipe.notes.length > 0 && (
        <section className="recipe-detail__notes">
          <h2>Notes</h2>
          {recipe.notes.map((note, i) => (
            <div key={i} className="recipe-note">
              {note.title && <h3>{note.title}</h3>}
              <p>{note.text}</p>
            </div>
          ))}
        </section>
      )}

      {recipe.orgURL && (
        <p className="recipe-detail__source">
          Source: <a href={recipe.orgURL} target="_blank" rel="noopener noreferrer">{recipe.orgURL}</a>
        </p>
      )}
    </main>
  )
}
