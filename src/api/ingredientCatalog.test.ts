import { beforeEach, expect, it, vi } from "vitest"

import * as sdk from "./generated/sdk.gen"
import { createIngredientMatch, loadIngredientCatalog } from "./ingredientCatalog"

vi.mock("./generated/sdk.gen", () => ({
  getAllApiFoodsGet: vi.fn(),
  getAllApiUnitsGet: vi.fn(),
  createOneApiFoodsPost: vi.fn(),
  createOneApiUnitsPost: vi.fn(),
}))
beforeEach(() => {
  vi.mocked(sdk.getAllApiFoodsGet).mockResolvedValue({
    data: { items: [{ id: "food", name: "Lamb" }] },
  } as never)
  vi.mocked(sdk.getAllApiUnitsGet).mockResolvedValue({
    data: { items: [{ id: "unit", name: "g" }] },
  } as never)
})
it("loads existing foods and units, including beyond the default first page", async () => {
  expect(await loadIngredientCatalog()).toEqual({
    food: [{ id: "food", name: "Lamb" }],
    unit: [{ id: "unit", name: "g" }],
  })
  expect(sdk.getAllApiFoodsGet).toHaveBeenCalledWith({ query: { perPage: -1 } })
})
it("reuses an existing match before attempting creation", async () => {
  expect(await createIngredientMatch("food", " lamb ")).toEqual({ id: "food", name: "Lamb" })
  expect(sdk.createOneApiFoodsPost).not.toHaveBeenCalled()
})
it("creates only the requested missing record and reports failures", async () => {
  vi.mocked(sdk.createOneApiUnitsPost)
    .mockResolvedValueOnce({ data: { id: "new", name: "cup" } } as never)
    .mockResolvedValueOnce({ error: {} } as never)
  expect(await createIngredientMatch("unit", " cup ")).toEqual({ id: "new", name: "cup" })
  await expect(createIngredientMatch("unit", "cup")).rejects.toThrow("Could not create")
})
it("does not create duplicates when the catalog cannot be checked", async () => {
  vi.mocked(sdk.getAllApiFoodsGet).mockResolvedValue({ error: {} } as never)
  await expect(createIngredientMatch("food", "new")).rejects.toThrow("Could not load")
  expect(sdk.createOneApiFoodsPost).not.toHaveBeenCalled()
})
