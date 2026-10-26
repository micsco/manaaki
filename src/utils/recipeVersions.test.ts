import { describe, expect, it } from "vitest"

import { encodeRecipeId } from "./recipe"
import { cookingMethod, recipeVersions } from "./recipeVersions"

const ovenId = "1133763e-1428-453c-8768-b422ea73baf0"
const airFryerId = "de0b5bf8-9d2a-4157-a1b2-35c0d37d3e0a"
const list = [
  { id: ovenId, slug: "bbq-potatoes" },
  { id: airFryerId, slug: "bbq-potatoes-air-fryer" },
]

describe("cookingMethod", () => {
  it("reads the method from the recipe's tools", () => {
    expect(cookingMethod({ tools: [{ name: "Air Fryer", slug: "air-fryer" }] })).toBe("airFryer")
    expect(cookingMethod({ tools: [{ name: "Slow Cooker", slug: "" }] })).toBe("slowCooker")
  })

  it("treats a recipe without a cooking tool as the oven version", () => {
    expect(cookingMethod({ tools: [] })).toBe("oven")
    expect(cookingMethod({})).toBe("oven")
  })
})

describe("recipeVersions", () => {
  it("links the oven recipe to its air fryer version by id", () => {
    const versions = recipeVersions(
      { id: ovenId, slug: "bbq-potatoes", tools: [], extras: { airFryerVersion: airFryerId } },
      list
    )
    expect(versions).toEqual([
      { method: "oven", label: "Oven", href: null, recipeId: ovenId },
      {
        method: "airFryer",
        label: "Air fryer",
        href: `/recipes/${encodeRecipeId(airFryerId)}/bbq-potatoes-air-fryer`,
        recipeId: airFryerId,
      },
    ])
  })

  it("keeps the oven first when viewing the air fryer version", () => {
    const versions = recipeVersions(
      {
        id: airFryerId,
        slug: "bbq-potatoes-air-fryer",
        tools: [{ name: "Air Fryer", slug: "air-fryer" }],
        extras: { ovenVersion: ovenId.toUpperCase() },
      },
      list
    )
    expect(versions.map(v => [v.label, v.href === null])).toEqual([
      ["Oven", false],
      ["Air fryer", true],
    ])
  })

  it("shows nothing when the linked recipe is missing or points at itself", () => {
    const recipe = { id: ovenId, slug: "bbq-potatoes", tools: [] }
    expect(recipeVersions({ ...recipe, extras: { airFryerVersion: "gone" } }, list)).toEqual([])
    expect(recipeVersions({ ...recipe, extras: { airFryerVersion: ovenId } }, list)).toEqual([])
    expect(recipeVersions({ ...recipe, extras: {} }, list)).toEqual([])
  })

  it("works out the air fryer copy's method when its tool is missing", () => {
    const versions = recipeVersions(
      {
        id: airFryerId,
        slug: "bbq-potatoes-air-fryer",
        tools: [],
        extras: { ovenVersion: ovenId },
      },
      list
    )
    expect(versions.map(v => [v.method, v.href === null])).toEqual([
      ["oven", false],
      ["airFryer", true],
    ])
  })

  it("ignores a link for the recipe's own method", () => {
    expect(
      recipeVersions(
        {
          id: ovenId,
          slug: "bbq-potatoes",
          tools: [{ name: "Air Fryer", slug: "air-fryer" }],
          extras: {
            airFryerVersion: airFryerId,
            ovenVersion: airFryerId,
            slowCookerVersion: ovenId,
          },
        },
        list
      ).map(v => v.method)
    ).toEqual(["oven", "airFryer"])
  })
})
