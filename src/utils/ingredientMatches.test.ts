import { expect, it } from "vitest"

import { rankIngredientMatches } from "./ingredientMatches"

it("ranks exact matches first without preferring prefixes", () => {
  const names = ["sweet lime", "apple", "lime juice", "finger lime", "lime"]
  const items = names.map(name => ({ name }))
  expect(rankIngredientMatches(items, "lime").map(item => item.name)).toEqual([
    "lime",
    "finger lime",
    "lime juice",
    "sweet lime",
    "apple",
  ])
  expect(items.map(item => item.name)).toEqual(names)
})

it("ignores case and surrounding whitespace", () => {
  expect(rankIngredientMatches([{ name: "lime juice" }, { name: "Lime" }], " LIME ")).toEqual([
    { name: "Lime" },
    { name: "lime juice" },
  ])
})

it("uses alphabetical order for an empty query and handles an empty catalog", () => {
  expect(rankIngredientMatches([{ name: "teaspoon" }, { name: "gram" }], " ")).toEqual([
    { name: "gram" },
    { name: "teaspoon" },
  ])
  expect(rankIngredientMatches([], "lime")).toEqual([])
})

it("orders partial matches by recipe usage regardless of word position", () => {
  const items = [
    { id: "juice", name: "lime juice" },
    { id: "finger", name: "finger lime" },
    { id: "lime", name: "lime" },
  ]
  expect(rankIngredientMatches(items, "lime", { juice: 2, finger: 20, lime: 1 })).toEqual([
    items[2],
    items[1],
    items[0],
  ])
})
