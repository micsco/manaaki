import { describe, expect, it } from "vitest"

import { attributionText, isSavedFromElsewhere, savedRecipeSource } from "./recipeProvenance"

describe("savedRecipeSource", () => {
  it("returns the source URL and a readable site name for recipes saved from elsewhere", () => {
    expect(savedRecipeSource({ orgURL: "https://www.bbcgoodfood.com/recipes/chilli" })).toEqual({
      url: "https://www.bbcgoodfood.com/recipes/chilli",
      site: "bbcgoodfood.com",
    })
  })

  it("treats recipes without a usable web source as our own", () => {
    expect(savedRecipeSource({ orgURL: null })).toBeNull()
    expect(savedRecipeSource({ orgURL: "  " })).toBeNull()
    expect(savedRecipeSource({ orgURL: "javascript:alert(1)" })).toBeNull()
    expect(isSavedFromElsewhere({ orgURL: undefined })).toBe(false)
  })
})

describe("attributionText", () => {
  it("credits the original author and links the source", () => {
    const text = attributionText({ url: "https://example.com/stew", site: "example.com" })
    expect(text).toContain("Saved from example.com")
    expect(text).toContain("original author")
    expect(text).toContain("https://example.com/stew")
  })
})
