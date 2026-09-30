import { describe, expect, it } from "vitest"

import { recipeNavHotkeyLabels, recipeNavHotkeys } from "./recipeHotkeys"

describe("recipe navigation hotkeys", () => {
  it("binds the arrow keys, which are the same on every keyboard layout", () => {
    expect(recipeNavHotkeys).toEqual({ prev: "ArrowLeft", next: "ArrowRight" })
  })

  it("shows arrow symbols for the hints", () => {
    expect(recipeNavHotkeyLabels).toEqual({ prev: "←", next: "→" })
  })
})
