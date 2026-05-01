import { describe, expect, it } from "vitest"
import { formatQuantity, formatTime, mealieRecipeUrl, recipeImageUrl } from "./recipe"

describe("mealieRecipeUrl", () => {
  it("returns the full Mealie recipe URL for a valid slug and group slug", () => {
    expect(mealieRecipeUrl("banana-bread", "my-family")).toBe(
      "https://mealie.scottfamily.nz/g/my-family/r/banana-bread"
    )
  })

  it("returns null for null slug", () => {
    expect(mealieRecipeUrl(null, "my-family")).toBeNull()
  })

  it("returns null for undefined slug", () => {
    expect(mealieRecipeUrl(undefined, "my-family")).toBeNull()
  })

  it("returns null for empty string slug", () => {
    expect(mealieRecipeUrl("", "my-family")).toBeNull()
  })

  it("returns null when groupSlug is null", () => {
    expect(mealieRecipeUrl("banana-bread", null)).toBeNull()
  })

  it("returns null when groupSlug is undefined", () => {
    expect(mealieRecipeUrl("banana-bread", undefined)).toBeNull()
  })
})

describe("recipeImageUrl", () => {
  it("returns null for null id", () => {
    expect(recipeImageUrl(null, "original")).toBeNull()
  })

  it("returns null for undefined id", () => {
    expect(recipeImageUrl(undefined, "original")).toBeNull()
  })

  it("returns null for empty string id", () => {
    expect(recipeImageUrl("", "original")).toBeNull()
  })

  it("returns correct path for original size", () => {
    expect(recipeImageUrl("abc-123", "original")).toBe(
      "/api/media/recipes/abc-123/images/original.webp"
    )
  })

  it("returns correct path for min-original size", () => {
    expect(recipeImageUrl("abc-123", "min-original")).toBe(
      "/api/media/recipes/abc-123/images/min-original.webp"
    )
  })
})

describe("formatTime", () => {
  it("returns null for null input", () => {
    expect(formatTime(null)).toBeNull()
  })

  it("returns null for undefined input", () => {
    expect(formatTime(undefined)).toBeNull()
  })

  it("returns null for empty string", () => {
    expect(formatTime("")).toBeNull()
  })

  it("formats minutes only", () => {
    expect(formatTime("PT30M")).toBe("30m")
  })

  it("formats hours only", () => {
    expect(formatTime("PT1H")).toBe("1h")
  })

  it("formats hours and minutes", () => {
    expect(formatTime("PT1H30M")).toBe("1h 30m")
  })

  it("formats multi-hour durations", () => {
    expect(formatTime("PT2H15M")).toBe("2h 15m")
  })

  it("formats single minute", () => {
    expect(formatTime("PT1M")).toBe("1m")
  })
})

describe("formatQuantity", () => {
  it("returns empty string for null", () => {
    expect(formatQuantity(null)).toBe("")
  })

  it("returns empty string for undefined", () => {
    expect(formatQuantity(undefined)).toBe("")
  })

  it("returns empty string for zero", () => {
    expect(formatQuantity(0)).toBe("")
  })

  it("formats whole numbers as strings", () => {
    expect(formatQuantity(1)).toBe("1")
    expect(formatQuantity(2)).toBe("2")
    expect(formatQuantity(10)).toBe("10")
  })

  it("formats half as unicode fraction", () => {
    expect(formatQuantity(0.5)).toBe("½")
  })

  it("formats quarter as unicode fraction", () => {
    expect(formatQuantity(0.25)).toBe("¼")
  })

  it("formats three-quarters as unicode fraction", () => {
    expect(formatQuantity(0.75)).toBe("¾")
  })

  it("formats one-third as unicode fraction", () => {
    expect(formatQuantity(0.333)).toBe("⅓")
  })

  it("formats two-thirds as unicode fraction", () => {
    expect(formatQuantity(0.667)).toBe("⅔")
  })

  it("formats mixed number with half", () => {
    expect(formatQuantity(1.5)).toBe("1½")
  })

  it("formats mixed number with quarter", () => {
    expect(formatQuantity(2.25)).toBe("2¼")
  })

  it("formats mixed number with third", () => {
    expect(formatQuantity(1.333)).toBe("1⅓")
  })

  it("formats non-fraction decimals as rounded numbers", () => {
    expect(formatQuantity(1.1)).toBe("1.1")
    expect(formatQuantity(2.75)).toBe("2¾")
  })

  it("formats eighth fractions", () => {
    expect(formatQuantity(0.125)).toBe("⅛")
    expect(formatQuantity(0.875)).toBe("⅞")
  })
})
