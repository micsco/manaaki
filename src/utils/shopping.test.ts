import { describe, expect, it } from "vitest"
import type {
  ReadPlanEntry,
  ShoppingListItemOutOutput,
  ShoppingListMultiPurposeLabelOut,
} from "../api/generated"
import {
  computeRecipeIncrement,
  gatherPlanRecipes,
  groupItemsByAisle,
  itemUpdateFromOutput,
  shoppingDayRange,
  shouldStartNewList,
} from "./shopping"

describe("shoppingDayRange", () => {
  it("spans exactly N days, today as day 1 (end = today + N-1)", () => {
    expect(shoppingDayRange(new Date(2026, 5, 28), 5)).toEqual({
      start: "2026-06-28",
      end: "2026-07-02",
    })
  })
  it("N=1 is just today", () => {
    expect(shoppingDayRange(new Date(2026, 11, 31), 1)).toEqual({
      start: "2026-12-31",
      end: "2026-12-31",
    })
  })
  it("crosses a month/year boundary correctly", () => {
    expect(shoppingDayRange(new Date(2026, 11, 30), 4)).toEqual({
      start: "2026-12-30",
      end: "2027-01-02",
    })
  })
})

function entry(over: Partial<ReadPlanEntry>): ReadPlanEntry {
  return {
    date: "2026-06-28",
    id: 1,
    groupId: "g",
    userId: "u",
    householdId: "h",
    ...over,
  } as ReadPlanEntry
}

describe("gatherPlanRecipes", () => {
  it("skips entries with no usable recipe id (free-text)", () => {
    const out = gatherPlanRecipes([entry({ title: "Takeaway", recipeId: null, recipe: null })])
    expect(out).toEqual([])
  })
  it("derives id from recipeId or recipe.id, name from recipe.name/title", () => {
    const out = gatherPlanRecipes([
      entry({ recipeId: "r1", recipe: { id: "r1", name: "Soup", recipeServings: 4 } as never }),
      entry({ recipeId: null, recipe: { id: "r2", name: null } as never, title: "Mystery" }),
    ])
    expect(out).toEqual([
      { recipeId: "r1", name: "Soup", baseServings: 4, occurrences: 1 },
      { recipeId: "r2", name: "Mystery", baseServings: null, occurrences: 1 },
    ])
  })
  it("aggregates duplicate recipes and counts occurrences", () => {
    const r = { id: "r1", name: "Chilli", recipeServings: 4 } as never
    const out = gatherPlanRecipes([
      entry({ recipeId: "r1", recipe: r }),
      entry({ recipeId: "r1", recipe: r }),
    ])
    expect(out).toEqual([{ recipeId: "r1", name: "Chilli", baseServings: 4, occurrences: 2 }])
  })
})

describe("computeRecipeIncrement", () => {
  it("servings mode: chosen / base", () => {
    expect(computeRecipeIncrement({ mode: "servings", value: 6, baseServings: 4 })).toBe(1.5)
  })
  it("multiplier mode: value passes through", () => {
    expect(computeRecipeIncrement({ mode: "multiplier", value: 2, baseServings: null })).toBe(2)
  })
  it("servings mode with base <= 0 or null falls back to value (no divide-by-zero)", () => {
    expect(computeRecipeIncrement({ mode: "servings", value: 2, baseServings: 0 })).toBe(2)
    expect(computeRecipeIncrement({ mode: "servings", value: 3, baseServings: null })).toBe(3)
  })
})

function item(over: Partial<ShoppingListItemOutOutput>): ShoppingListItemOutOutput {
  return {
    id: "i",
    shoppingListId: "l",
    groupId: "g",
    householdId: "h",
    ...over,
  } as ShoppingListItemOutOutput
}

describe("itemUpdateFromOutput", () => {
  it("copies only accepted scalar/id fields + applies patch (never response-only fields)", () => {
    const out = itemUpdateFromOutput(
      item({
        id: "i1",
        shoppingListId: "l1",
        quantity: 2,
        note: "n",
        display: "2 eggs",
        position: 3,
        foodId: "f",
        labelId: "lab",
        unitId: "u",
        checked: false,
      }),
      { checked: true }
    )
    expect(out).toEqual({
      shoppingListId: "l1",
      quantity: 2,
      note: "n",
      display: "2 eggs",
      position: 3,
      foodId: "f",
      labelId: "lab",
      unitId: "u",
      checked: true,
    })
    expect(out).not.toHaveProperty("id")
    expect(out).not.toHaveProperty("label")
    expect(out).not.toHaveProperty("food")
  })
})

describe("groupItemsByAisle", () => {
  const settings = [
    {
      id: "s2",
      shoppingListId: "l",
      labelId: "produce",
      position: 1,
      label: { id: "produce", name: "Produce", groupId: "g" },
    },
    {
      id: "s1",
      shoppingListId: "l",
      labelId: "dairy",
      position: 0,
      label: { id: "dairy", name: "Dairy", groupId: "g" },
    },
  ] as ShoppingListMultiPurposeLabelOut[]
  it("groups by label, orders groups by labelSettings position, unlabelled last", () => {
    const items = [
      item({
        id: "a",
        labelId: "produce",
        label: { id: "produce", name: "Produce", groupId: "g" } as never,
      }),
      item({
        id: "b",
        labelId: "dairy",
        label: { id: "dairy", name: "Dairy", groupId: "g" } as never,
      }),
      item({ id: "c", labelId: null, label: null }),
    ]
    const groups = groupItemsByAisle(items, settings)
    expect(groups.map(g => g.name)).toEqual(["Dairy", "Produce", "Other"])
    expect(groups[2].items.map(i => i.id)).toEqual(["c"])
  })
})

describe("shouldStartNewList", () => {
  const now = Date.parse("2026-06-28T12:00:00Z")
  it("true when there is no createdAt", () => {
    expect(shouldStartNewList(null, now)).toBe(true)
    expect(shouldStartNewList(undefined, now)).toBe(true)
  })
  it("true when createdAt is unparseable", () => {
    expect(shouldStartNewList("not-a-date", now)).toBe(true)
  })
  it("false when <= 48h old", () => {
    expect(shouldStartNewList("2026-06-26T12:00:01Z", now)).toBe(false)
  })
  it("true when > 48h old", () => {
    expect(shouldStartNewList("2026-06-26T11:59:59Z", now)).toBe(true)
  })
})
