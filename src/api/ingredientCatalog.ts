import {
  createOneApiFoodsPost,
  createOneApiUnitsPost,
  getAllApiFoodsGet,
  getAllApiUnitsGet,
} from "./generated/sdk.gen"

export type IngredientMatch = { id?: string | null; name: string }
export type IngredientCatalog = { food: IngredientMatch[]; unit: IngredientMatch[] }

export async function loadIngredientCatalog(): Promise<IngredientCatalog> {
  const [foods, units] = await Promise.all([
    getAllApiFoodsGet({ query: { perPage: -1 } }),
    getAllApiUnitsGet({ query: { perPage: -1 } }),
  ])
  if (foods.error || units.error || !foods.data || !units.data)
    throw new Error(
      "Could not load existing foods and units. Try again before creating new records."
    )
  return { food: foods.data.items, unit: units.data.items }
}

export async function createIngredientMatch(
  kind: "food" | "unit",
  name: string
): Promise<IngredientMatch> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error("Enter a name first.")
  const catalog = await loadIngredientCatalog()
  const existing = catalog[kind].find(item => item.name.toLowerCase() === trimmed.toLowerCase())
  if (existing) return existing
  const result =
    kind === "food"
      ? await createOneApiFoodsPost({ body: { name: trimmed } })
      : await createOneApiUnitsPost({ body: { name: trimmed } })
  if (result.error || !result.data)
    throw new Error(`Could not create this ${kind}. Choose an existing match or try again.`)
  return result.data
}
