import userEvent from "@testing-library/user-event"
import { beforeEach, expect, it, vi } from "vitest"

import { loadFoodRecipeCount } from "../api/ingredientPopularity"
import { render, screen, waitFor } from "../test/render"
import { IngredientSuggestions } from "./IngredientSuggestions"

vi.mock("../api/ingredientPopularity", () => ({ loadFoodRecipeCount: vi.fn() }))

const items = [
  { id: "juice", name: "lime juice" },
  { id: "finger", name: "finger lime" },
  { id: "lime", name: "lime" },
  { id: "apple", name: "apple" },
]
const props = { id: "foods", items, query: "lime", userId: "user", popularityEnabled: true }

beforeEach(() => {
  vi.mocked(loadFoodRecipeCount).mockImplementation(
    async id => ({ juice: 20, finger: 2, lime: 1 })[id] ?? 0
  )
})

it("keeps the exact match first then orders by usage, reusing cached counts", async () => {
  render(
    <>
      <input aria-label="Food" list="foods" />
      <IngredientSuggestions {...props} />
      <IngredientSuggestions {...props} id="other-foods" query="lime juice" />
    </>
  )
  const input = screen.getByRole<HTMLInputElement>("combobox", { name: "Food" })
  await userEvent.click(input)
  await waitFor(() =>
    expect(Array.from(input.list!.options, option => option.value)).toEqual([
      "lime",
      "lime juice",
      "finger lime",
      "apple",
    ])
  )
  expect(input).toHaveFocus()
  expect(loadFoodRecipeCount).toHaveBeenCalledTimes(3)
  expect(loadFoodRecipeCount).not.toHaveBeenCalledWith("apple", expect.anything())
})

it("falls back to exact match then alphabetical order when counts fail", async () => {
  vi.mocked(loadFoodRecipeCount).mockRejectedValue(new Error("Unavailable"))
  render(
    <>
      <input aria-label="Food" list="foods" />
      <IngredientSuggestions {...props} />
    </>
  )
  await waitFor(() => expect(loadFoodRecipeCount).toHaveBeenCalledTimes(3))
  const input = screen.getByRole<HTMLInputElement>("combobox", { name: "Food" })
  expect(Array.from(input.list!.options, option => option.value)).toEqual([
    "lime",
    "finger lime",
    "lime juice",
    "apple",
  ])
})

it.each([
  { popularityEnabled: false, query: "lime" },
  { popularityEnabled: true, query: "" },
  { popularityEnabled: true, query: "l" },
])("avoids count requests when disabled or the query is too broad: %s", async overrides => {
  render(<IngredientSuggestions {...props} {...overrides} />)
  expect(loadFoodRecipeCount).not.toHaveBeenCalled()
})
