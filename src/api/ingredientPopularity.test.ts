import { expect, it, vi } from "vitest"

import { getAllApiRecipesGet } from "./generated/sdk.gen"
import { loadFoodRecipeCount } from "./ingredientPopularity"

vi.mock("./generated/sdk.gen", () => ({ getAllApiRecipesGet: vi.fn() }))

it("uses the total matching recipes without downloading all recipes", async () => {
  vi.mocked(getAllApiRecipesGet).mockResolvedValue({ data: { items: [], total: 42 } } as never)
  const signal = new AbortController().signal
  expect(await loadFoodRecipeCount("lime", signal)).toBe(42)
  expect(getAllApiRecipesGet).toHaveBeenCalledWith({
    query: { foods: ["lime"], perPage: 1 },
    signal,
  })
})

it.each([{ error: {} }, { data: { items: [] } }])("rejects unavailable counts", async result => {
  vi.mocked(getAllApiRecipesGet).mockResolvedValue(result)
  await expect(loadFoodRecipeCount("lime")).rejects.toThrow("Could not load")
})
