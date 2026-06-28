import { describe, expect, it } from "vitest"
import type { ReadPlanEntry } from "../api/generated"
import { gatherPlanRecipes, shoppingDayRange } from "./shopping"

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
