import { describe, expect, it } from "vitest"

import { sharedRecipeUrl, validateShareSearch } from "./sharedRecipe"

describe("incoming recipe shares", () => {
  it.each([
    [{ url: "https://example.com/recipe?a=1&b=two" }, "https://example.com/recipe?a=1&b=two"],
    [
      { text: "Watch this! https://www.youtube.com/shorts/abc?si=123" },
      "https://www.youtube.com/shorts/abc?si=123",
    ],
    [
      { text: "Dinner (https://www.instagram.com/reel/abc/)." },
      "https://www.instagram.com/reel/abc/",
    ],
    [{ title: "https://example.com/recipe_(food)" }, "https://example.com/recipe_(food)"],
    [
      { url: "https://example.com/original", text: "https://example.com/other" },
      "https://example.com/original",
    ],
    [{ url: "javascript:alert(1)", text: "Dinner!" }, ""],
    [{ url: "https://user:secret@example.com/private" }, ""],
  ])("extracts a safe link from %j", (input, expected) => {
    expect(sharedRecipeUrl(validateShareSearch(input))).toBe(expected)
  })

  it("ignores objects, arrays, and oversized inputs", () => {
    expect(
      validateShareSearch({ url: {}, text: ["https://example.com"], title: "a".repeat(16385) })
    ).toEqual({ url: "", text: "", title: "" })
  })
})
