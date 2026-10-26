import type { RecipeSummary, RecipeTool } from "../api/generated/types.gen"
import { recipeUrl } from "./recipe"

export type CookingMethod = "oven" | "airFryer" | "slowCooker"

const METHOD_ORDER: CookingMethod[] = ["oven", "airFryer", "slowCooker"]

export const COOKING_METHOD_LABELS: Record<CookingMethod, string> = {
  oven: "Oven",
  airFryer: "Air fryer",
  slowCooker: "Slow cooker",
}

const VERSION_EXTRAS_KEYS: Record<CookingMethod, string> = {
  oven: "ovenVersion",
  airFryer: "airFryerVersion",
  slowCooker: "slowCookerVersion",
}

const METHOD_TOOL_SLUGS: [CookingMethod, string][] = [
  ["airFryer", "air-fryer"],
  ["slowCooker", "slow-cooker"],
]

type VersionedRecipe = {
  id?: string | null
  slug?: string | null
  tools?: Pick<RecipeTool, "slug" | "name">[] | null
  extras?: Record<string, unknown> | null
}

export type RecipeVersion = {
  method: CookingMethod
  label: string
  href: string | null
  recipeId: string
}

function toolSlug(tool: Pick<RecipeTool, "slug" | "name">): string {
  return (tool.slug || tool.name || "").trim().toLowerCase().replace(/\s+/g, "-")
}

function linkedId(recipe: Pick<VersionedRecipe, "extras">, method: CookingMethod): string | null {
  const value = recipe.extras?.[VERSION_EXTRAS_KEYS[method]]
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null
}

export function cookingMethod(recipe: Pick<VersionedRecipe, "tools" | "extras">): CookingMethod {
  const slugs = (recipe.tools ?? []).map(toolSlug)
  const fromTools = METHOD_TOOL_SLUGS.find(([, slug]) => slugs.includes(slug))?.[0] ?? "oven"
  if (!linkedId(recipe, fromTools)) return fromTools
  return METHOD_ORDER.find(method => !linkedId(recipe, method)) ?? fromTools
}

export function recipeVersions(
  recipe: VersionedRecipe,
  recipes: Pick<RecipeSummary, "id" | "slug">[]
): RecipeVersion[] {
  if (!recipe.id || !recipe.slug) return []
  const current = cookingMethod(recipe)
  const byId = new Map(recipes.filter(r => r.id && r.slug).map(r => [r.id, r]))
  const versions = new Map<CookingMethod, RecipeVersion>([
    [
      current,
      { method: current, label: COOKING_METHOD_LABELS[current], href: null, recipeId: recipe.id },
    ],
  ])
  for (const method of METHOD_ORDER) {
    if (method === current) continue
    const id = linkedId(recipe, method)
    if (!id) continue
    const linked = byId.get(id)
    if (!linked?.id || !linked.slug || linked.id === recipe.id) continue
    versions.set(method, {
      method,
      label: COOKING_METHOD_LABELS[method],
      href: recipeUrl(linked.id, linked.slug),
      recipeId: linked.id,
    })
  }
  if (versions.size < 2) return []
  return METHOD_ORDER.flatMap(method => versions.get(method) ?? [])
}
