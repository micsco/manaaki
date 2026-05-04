import { describe, expect, it } from "vitest"
import type { RecipeSummary } from "../api/generated/types.gen"
import { applyRecipeFilters } from "./useRecipeFilters"

function makeRecipe(overrides: Partial<RecipeSummary> = {}): RecipeSummary {
  return {
    id: "recipe-id",
    slug: "test-recipe",
    name: "Test Recipe",
    ...overrides,
  }
}

describe("applyRecipeFilters", () => {
  describe("search", () => {
    it("returns all recipes when search is empty", () => {
      const recipes = [makeRecipe({ name: "Banana Bread" }), makeRecipe({ name: "Apple Pie" })]
      expect(applyRecipeFilters(recipes, "", [], [], null)).toHaveLength(2)
    })

    it("filters by name case-insensitively", () => {
      const recipes = [makeRecipe({ name: "Banana Bread" }), makeRecipe({ name: "Apple Pie" })]
      const result = applyRecipeFilters(recipes, "banana", [], [], null)
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe("Banana Bread")
    })

    it("matches partial name substrings", () => {
      const recipes = [makeRecipe({ name: "Slow Cooker Chicken" })]
      expect(applyRecipeFilters(recipes, "chicken", [], [], null)).toHaveLength(1)
    })

    it("returns empty when nothing matches the search", () => {
      const recipes = [makeRecipe({ name: "Apple Pie" })]
      expect(applyRecipeFilters(recipes, "pasta", [], [], null)).toHaveLength(0)
    })
  })

  describe("protein filter", () => {
    it("matches protein via tags", () => {
      const recipe = makeRecipe({ tags: [{ name: "Chicken", slug: "chicken" }] })
      expect(applyRecipeFilters([recipe], "", ["chicken"], [], null)).toHaveLength(1)
    })

    it("matches protein via categories", () => {
      const recipe = makeRecipe({
        recipeCategory: [{ name: "Beef Recipes", slug: "beef-recipes" }],
      })
      expect(applyRecipeFilters([recipe], "", ["beef"], [], null)).toHaveLength(1)
    })

    it("matches protein via tools (case-insensitive)", () => {
      const recipe = makeRecipe({
        tools: [{ id: "1", name: "Pork Rib Rack", slug: "pork-rib-rack" }],
      })
      expect(applyRecipeFilters([recipe], "", ["pork"], [], null)).toHaveLength(1)
    })

    it("excludes recipes that do not match selected protein", () => {
      const recipe = makeRecipe({ tags: [{ name: "Vegetarian", slug: "vegetarian" }] })
      expect(applyRecipeFilters([recipe], "", ["chicken"], [], null)).toHaveLength(0)
    })

    it("matches any of the selected proteins (OR logic)", () => {
      const chickenRecipe = makeRecipe({ tags: [{ name: "Chicken", slug: "chicken" }] })
      const beefRecipe = makeRecipe({ tags: [{ name: "Beef", slug: "beef" }] })
      const result = applyRecipeFilters(
        [chickenRecipe, beefRecipe],
        "",
        ["chicken", "beef"],
        [],
        null
      )
      expect(result).toHaveLength(2)
    })

    it("returns all when no proteins selected", () => {
      const recipe = makeRecipe({ tags: [{ name: "Chicken", slug: "chicken" }] })
      expect(applyRecipeFilters([recipe], "", [], [], null)).toHaveLength(1)
    })
  })

  describe("tool filter", () => {
    it("matches tool via tools array", () => {
      const recipe = makeRecipe({
        tools: [{ id: "1", name: "Slow Cooker", slug: "slow-cooker" }],
      })
      expect(applyRecipeFilters([recipe], "", [], ["slow cooker"], null)).toHaveLength(1)
    })

    it("matches tool via tags", () => {
      const recipe = makeRecipe({ tags: [{ name: "Air Fryer", slug: "air-fryer" }] })
      expect(applyRecipeFilters([recipe], "", [], ["air fryer"], null)).toHaveLength(1)
    })

    it("excludes recipes that do not match the selected tool", () => {
      const recipe = makeRecipe({ tools: [{ id: "1", name: "Stand Mixer", slug: "stand-mixer" }] })
      expect(applyRecipeFilters([recipe], "", [], ["slow cooker"], null)).toHaveLength(0)
    })

    it("returns all when no tools selected", () => {
      const recipe = makeRecipe({ tools: [{ id: "1", name: "Stand Mixer", slug: "stand-mixer" }] })
      expect(applyRecipeFilters([recipe], "", [], [], null)).toHaveLength(1)
    })
  })

  describe("time bucket filter", () => {
    it("includes recipes under 30 minutes in the under30 bucket", () => {
      const recipe = makeRecipe({ totalTime: "20 minutes" })
      expect(applyRecipeFilters([recipe], "", [], [], "under30")).toHaveLength(1)
    })

    it("excludes recipes at or over 30 minutes from the under30 bucket", () => {
      const recipe = makeRecipe({ totalTime: "30 minutes" })
      expect(applyRecipeFilters([recipe], "", [], [], "under30")).toHaveLength(0)
    })

    it("includes recipes between 30 and 60 minutes in 30to60 bucket", () => {
      const recipe = makeRecipe({ totalTime: "45 minutes" })
      expect(applyRecipeFilters([recipe], "", [], [], "30to60")).toHaveLength(1)
    })

    it("includes recipes at 30 minutes in 30to60 bucket", () => {
      const recipe = makeRecipe({ totalTime: "30 minutes" })
      expect(applyRecipeFilters([recipe], "", [], [], "30to60")).toHaveLength(1)
    })

    it("excludes recipes at 60 minutes from 30to60 bucket", () => {
      const recipe = makeRecipe({ totalTime: "1 hour" })
      expect(applyRecipeFilters([recipe], "", [], [], "30to60")).toHaveLength(0)
    })

    it("includes 1 hour 30 mins in 60to120 bucket", () => {
      const recipe = makeRecipe({ totalTime: "1 hour 30 minutes" })
      expect(applyRecipeFilters([recipe], "", [], [], "60to120")).toHaveLength(1)
    })

    it("includes recipes at or over 2 hours in over120 bucket", () => {
      const recipe = makeRecipe({ totalTime: "3 hours" })
      expect(applyRecipeFilters([recipe], "", [], [], "over120")).toHaveLength(1)
    })

    it("excludes recipes with no parsable time from any bucket", () => {
      const recipe = makeRecipe({ totalTime: null })
      expect(applyRecipeFilters([recipe], "", [], [], "under30")).toHaveLength(0)
    })

    it("excludes recipes with freeform unparsable time from any bucket", () => {
      const recipe = makeRecipe({ totalTime: "10 mins, plus marinating" })
      expect(applyRecipeFilters([recipe], "", [], [], "under30")).toHaveLength(0)
    })

    it("returns all when time is null", () => {
      const recipe = makeRecipe({ totalTime: "30 minutes" })
      expect(applyRecipeFilters([recipe], "", [], [], null)).toHaveLength(1)
    })
  })

  describe("combined filters", () => {
    it("applies search and protein filter together", () => {
      const match = makeRecipe({
        name: "Chicken Curry",
        tags: [{ name: "Chicken", slug: "chicken" }],
      })
      const noProtein = makeRecipe({ name: "Chicken Soup" })
      const noSearch = makeRecipe({
        name: "Beef Stew",
        tags: [{ name: "Chicken", slug: "chicken" }],
      })
      const result = applyRecipeFilters(
        [match, noProtein, noSearch],
        "chicken",
        ["chicken"],
        [],
        null
      )
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe("Chicken Curry")
    })

    it("applies protein, tool and time filters together", () => {
      const match = makeRecipe({
        tags: [{ name: "Chicken", slug: "chicken" }],
        tools: [{ id: "1", name: "Slow Cooker", slug: "slow-cooker" }],
        totalTime: "4 hours",
      })
      const wrongTime = makeRecipe({
        tags: [{ name: "Chicken", slug: "chicken" }],
        tools: [{ id: "1", name: "Slow Cooker", slug: "slow-cooker" }],
        totalTime: "20 minutes",
      })
      const result = applyRecipeFilters(
        [match, wrongTime],
        "",
        ["chicken"],
        ["slow cooker"],
        "over120"
      )
      expect(result).toHaveLength(1)
      expect(result[0].totalTime).toBe("4 hours")
    })
  })
})
