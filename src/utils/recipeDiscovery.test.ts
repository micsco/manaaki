import { describe, expect, it } from "vitest"

import type { RecipeTimelineEventOut } from "../api/generated/types.gen"
import { buildRecipeDiscovery } from "./recipeDiscovery"

const now = new Date("2026-09-26T12:00:00")
const recipes = ["recent", "forgotten", "seasonal", "never"].map(id => ({ id, slug: id, name: id }))
function cooks(
  recipeId: string,
  dates: string[],
  extra: Partial<RecipeTimelineEventOut> = {}
): RecipeTimelineEventOut[] {
  return dates.map((date, i) => ({
    id: `${recipeId}-${i}`,
    recipeId,
    householdId: "home",
    groupId: "group",
    userId: "cook",
    eventType: "info",
    subject: "Mike made this for dinner",
    timestamp: `${date}T12:00:00`,
    createdAt: "",
    updatedAt: "",
    ...extra,
  }))
}
function rank(events: RecipeTimelineEventOut[]) {
  return buildRecipeDiscovery(recipes, events, "home", ["recent"], now)
}

it("builds distinct rows from cooking days, with upcoming plan labels", () => {
  const rows = rank([
    ...cooks("recent", ["2026-09-01", "2026-09-20"]),
    ...cooks("forgotten", ["2024-01-01", "2024-01-10", "2024-02-01"]),
    ...cooks("seasonal", ["2025-09-01", "2025-09-20", "2025-09-21"]),
  ])
  expect(rows.map(row => row.id)).toEqual(["recent", "forgotten", "seasonal"])
  expect(rows.map(row => row.items[0].recipe.id)).toEqual(["recent", "forgotten", "seasonal"])
  expect(rows[0].items[0]).toMatchObject({
    planned: true,
    reason: "Cooked on 2 days in the last 90 days",
  })
  expect(rows[1].items[0].reason).toContain("Feb 2024")
})

it("deduplicates manual and automatic cooking on the same day, including different users", () => {
  expect(
    rank([
      ...cooks("recent", ["2026-09-01"]),
      ...cooks("recent", ["2026-09-01"], {
        eventType: "comment",
        userId: "other",
        subject: "Other made this",
      }),
    ])
  ).toEqual([])
  const rows = rank([
    ...cooks("recent", ["2026-09-01"]),
    ...cooks("recent", ["2026-09-02"], { eventType: "comment", subject: "Other made this" }),
  ])
  expect(rows[0].items[0].reason).toContain("2 days")
})

it("ignores unrelated activity, other households, invalid dates, future meals and missing recipes", () => {
  const dates = ["2026-09-01", "2026-09-02", "2026-09-03"]
  expect(
    rank([
      ...cooks("recent", dates, { subject: "Recipe updated" }),
      ...cooks("recent", dates, { householdId: "other" }),
      ...cooks("recent", dates, { eventType: "system" }),
      ...cooks("recent", dates, { timestamp: "invalid" }),
      ...cooks("recent", dates, { timestamp: undefined }),
      ...cooks("recent", ["2027-01-01", "2027-01-02"]),
      ...cooks("deleted", dates),
    ])
  ).toEqual([])
})

it("uses an inclusive 90-day window and requires repeat cooking", () => {
  expect(rank(cooks("recent", ["2026-06-28", "2026-06-29"]))).toEqual([])
  expect(rank(cooks("recent", ["2026-06-29", "2026-09-26"]))[0].items[0].recipe.id).toBe("recent")
})

it("requires three historical cooks and six months away for forgotten favourites", () => {
  expect(rank(cooks("forgotten", ["2026-01-01", "2026-01-02"]))).toEqual([])
  expect(rank(cooks("forgotten", ["2026-01-01", "2026-01-02", "2026-03-26"]))).toEqual([])
  expect(rank(cooks("forgotten", ["2026-01-01", "2026-01-02", "2026-03-25"]))[0].id).toBe(
    "forgotten"
  )
})

it("handles seasonal windows crossing a year boundary", () => {
  const rows = buildRecipeDiscovery(
    recipes,
    cooks("seasonal", ["2024-12-20", "2025-01-20"]),
    "home",
    [],
    new Date("2026-01-01T12:00:00")
  )
  expect(rows[0].id).toBe("seasonal")
})

it("caps rows at six and breaks tied scores deterministically", () => {
  const many = Array.from({ length: 8 }, (_, i) => ({ id: `id${i}`, slug: `id${i}` }))
  const events = many.flatMap(recipe => cooks(recipe.id, ["2026-09-01", "2026-09-02"]))
  const first = buildRecipeDiscovery(many, events, "home", [], now)
  const reversed = buildRecipeDiscovery(
    [...many].sort((a, b) => b.id.localeCompare(a.id)),
    [...events].sort((a, b) => b.id.localeCompare(a.id)),
    "home",
    [],
    now
  )
  expect(first).toEqual(reversed)
  expect(first[0].items).toHaveLength(6)
})

describe("scheduler meal types", () => {
  it.each([
    "for breakfast",
    "for lunch",
    "for dinner",
    "as a side",
    "for snack",
    "for dessert",
    "for drink",
  ])("recognises meals %s", suffix => {
    expect(
      rank(
        cooks("recent", ["2026-09-01", "2026-09-02"], { subject: `Mike made this ${suffix}` })
      )[0].id
    ).toBe("recent")
  })
})
