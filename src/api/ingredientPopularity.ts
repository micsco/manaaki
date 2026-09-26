import { getAllApiRecipesGet } from "./generated/sdk.gen"

export async function loadFoodRecipeCount(foodId: string, signal?: AbortSignal): Promise<number> {
  const result = await getAllApiRecipesGet({
    query: { foods: [foodId], perPage: 1 },
    signal,
  })
  if (result.error || !result.data || typeof result.data.total !== "number")
    throw new Error("Could not load ingredient popularity.")
  return result.data.total
}
