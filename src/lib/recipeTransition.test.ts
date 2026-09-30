import { afterEach, describe, expect, it, vi } from "vitest"

import {
  markRecipeNavigation,
  prefersReducedMotion,
  recipeTransitionTypes,
  takeRecipeNavigation,
} from "./recipeTransition"

describe("recipe navigation intent", () => {
  afterEach(() => {
    takeRecipeNavigation("")
    vi.unstubAllGlobals()
  })

  it("returns the direction marked for the recipe being opened", () => {
    markRecipeNavigation("next-recipe", "next")
    expect(takeRecipeNavigation("next-recipe")).toBe("next")
  })

  it("is consumed once so later navigations to the same recipe are not animated", () => {
    markRecipeNavigation("prev-recipe", "prev")
    takeRecipeNavigation("prev-recipe")
    expect(takeRecipeNavigation("prev-recipe")).toBeNull()
  })

  it("ignores a stale intent for a different recipe, such as browser history navigation", () => {
    markRecipeNavigation("abandoned", "next")
    expect(takeRecipeNavigation("from-history")).toBeNull()
    expect(takeRecipeNavigation("abandoned")).toBeNull()
  })

  it("keeps opposite transition types for each direction", () => {
    expect(recipeTransitionTypes.prev).not.toBe(recipeTransitionTypes.next)
  })

  it("reads the reduced motion preference", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({ matches: query === "(prefers-reduced-motion: reduce)" }))
    )
    expect(prefersReducedMotion()).toBe(true)
  })
})
