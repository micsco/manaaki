import type { ReactNode } from "react"
import type { RecipeOutput } from "../api/generated/types.gen"
import { RecipeMetadata } from "./RecipeMetadata"
import { Badge } from "./ui"

export function RecipeHeader({
  recipe,
  img,
  actions,
}: {
  recipe: RecipeOutput
  img: string | null
  actions: ReactNode
}) {
  return (
    <>
      {img && (
        <div className="mb-8">
          <img
            className="h-64 w-full rounded-lg object-cover shadow-lg"
            src={img}
            alt={recipe.name ?? ""}
            width={800}
            height={400}
          />
        </div>
      )}
      <h1 className="mb-4 font-bold text-4xl text-gray-100">{recipe.name}</h1>
      {recipe.description && (
        <p className="mb-6 text-gray-300 text-lg leading-relaxed">{recipe.description}</p>
      )}
      <RecipeMetadata recipe={recipe} />
      {recipe.recipeCategory?.length || recipe.tags?.length ? (
        <div className="mb-8 flex flex-wrap gap-2">
          {recipe.recipeCategory?.map(c => (
            <Badge key={c.id ?? c.slug} variant="category">
              {c.name}
            </Badge>
          ))}
          {recipe.tags?.map(t => (
            <Badge key={t.id ?? t.slug} variant="tag">
              {t.name}
            </Badge>
          ))}
        </div>
      ) : null}
      <div className="mb-8">{actions}</div>
    </>
  )
}
