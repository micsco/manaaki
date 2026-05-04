import { describe, expect, it } from "vitest"
import {
  formatQuantity,
  formatTime,
  groupByTitle,
  mealieRecipeUrl,
  parseTimeMinutes,
  recipeImageUrl,
} from "./recipe"

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

  it("returns correct path for original size without cache key", () => {
    expect(recipeImageUrl("abc-123", "original")).toBe(
      "/api/media/recipes/abc-123/images/original.webp"
    )
  })

  it("returns correct path for min-original size without cache key", () => {
    expect(recipeImageUrl("abc-123", "min-original")).toBe(
      "/api/media/recipes/abc-123/images/min-original.webp"
    )
  })

  it("appends ?v= cache buster when cache key is provided", () => {
    expect(recipeImageUrl("abc-123", "original", "XeRg")).toBe(
      "/api/media/recipes/abc-123/images/original.webp?v=XeRg"
    )
  })

  it("appends ?v= cache buster for min-original size", () => {
    expect(recipeImageUrl("abc-123", "min-original", "XeRg")).toBe(
      "/api/media/recipes/abc-123/images/min-original.webp?v=XeRg"
    )
  })

  it("omits ?v= when cache key is null", () => {
    expect(recipeImageUrl("abc-123", "original", null)).toBe(
      "/api/media/recipes/abc-123/images/original.webp"
    )
  })

  it("omits ?v= when cache key is a non-string (unknown) value", () => {
    expect(recipeImageUrl("abc-123", "original", 42)).toBe(
      "/api/media/recipes/abc-123/images/original.webp"
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

  it("returns null for the literal string 'none'", () => {
    expect(formatTime("none")).toBeNull()
  })

  it("compacts minutes-only string", () => {
    expect(formatTime("30 minutes")).toBe("30m")
  })

  it("compacts abbreviated minutes", () => {
    expect(formatTime("15 mins")).toBe("15m")
  })

  it("compacts single minute", () => {
    expect(formatTime("2 minutes")).toBe("2m")
  })

  it("compacts hours-only string", () => {
    expect(formatTime("1 hour")).toBe("1h")
  })

  it("compacts plural hours", () => {
    expect(formatTime("8 hours")).toBe("8h")
  })

  it("compacts hours and minutes", () => {
    expect(formatTime("1 hour 15 minutes")).toBe("1h 15m")
  })

  it("compacts hours and abbreviated minutes", () => {
    expect(formatTime("2 hours 5 minutes")).toBe("2h 5m")
  })

  it("compacts long durations", () => {
    expect(formatTime("8 hours 25 minutes")).toBe("8h 25m")
  })

  it("returns freeform strings as-is when pattern is unrecognised", () => {
    expect(formatTime("10 mins, plus 2 hrs marinating")).toBe("10 mins, plus 2 hrs marinating")
  })

  it("returns strings with extra context as-is", () => {
    expect(formatTime("15 mins, plus chilling")).toBe("15 mins, plus chilling")
  })
})

describe("groupByTitle", () => {
  it("returns a single group with no title when all items have no title", () => {
    const items = [{ title: null }, { title: null }]
    const result = groupByTitle(items)
    expect(result).toHaveLength(1)
    expect(result[0].title).toBeNull()
    expect(result[0].items).toHaveLength(2)
  })

  it("returns an empty array for an empty input", () => {
    expect(groupByTitle([])).toHaveLength(0)
  })

  it("splits items into groups based on title markers", () => {
    const items = [
      { title: "Section A" },
      { title: null },
      { title: null },
      { title: "Section B" },
      { title: null },
    ]
    const result = groupByTitle(items)
    expect(result).toHaveLength(2)
    expect(result[0].title).toBe("Section A")
    expect(result[0].items).toHaveLength(2)
    expect(result[1].title).toBe("Section B")
    expect(result[1].items).toHaveLength(1)
  })

  it("preserves the original index of each item", () => {
    const items = [{ title: null }, { title: null }, { title: null }]
    const result = groupByTitle(items)
    expect(result[0].items[0].index).toBe(0)
    expect(result[0].items[1].index).toBe(1)
    expect(result[0].items[2].index).toBe(2)
  })

  it("does not include title-marker items in the items array", () => {
    const items = [{ title: "Header" }, { title: null, name: "item" }]
    const result = groupByTitle(items)
    expect(result[0].items).toHaveLength(1)
    expect(result[0].items[0].item).toEqual({ title: null, name: "item" })
  })

  it("handles a title with no following items", () => {
    const items = [{ title: "Lonely section" }]
    const result = groupByTitle(items)
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe("Lonely section")
    expect(result[0].items).toHaveLength(0)
  })
})

describe("parseTimeMinutes", () => {
  it("returns null for null input", () => {
    expect(parseTimeMinutes(null)).toBeNull()
  })

  it("returns null for undefined input", () => {
    expect(parseTimeMinutes(undefined)).toBeNull()
  })

  it("returns null for empty string", () => {
    expect(parseTimeMinutes("")).toBeNull()
  })

  it("returns null for the literal string 'none'", () => {
    expect(parseTimeMinutes("none")).toBeNull()
  })

  it("returns null for unrecognised freeform strings", () => {
    expect(parseTimeMinutes("10 mins, plus 2 hrs marinating")).toBeNull()
  })

  it("parses minutes-only string", () => {
    expect(parseTimeMinutes("30 minutes")).toBe(30)
  })

  it("parses abbreviated minutes", () => {
    expect(parseTimeMinutes("15 mins")).toBe(15)
  })

  it("parses hours-only string", () => {
    expect(parseTimeMinutes("1 hour")).toBe(60)
  })

  it("parses plural hours", () => {
    expect(parseTimeMinutes("2 hours")).toBe(120)
  })

  it("parses hours and minutes combined", () => {
    expect(parseTimeMinutes("1 hour 15 minutes")).toBe(75)
  })

  it("parses hours and abbreviated minutes combined", () => {
    expect(parseTimeMinutes("2 hours 30 mins")).toBe(150)
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
