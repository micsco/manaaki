import { describe, expect, it } from "vitest"

import type { DraftRequestRecipe } from "../../src/server/recipeVersionAi"
import { goodAirFryerDraft, ovenSource } from "../../src/test/fixtures/recipeVersionDrafts"
import { judgeContent, judgePrompt } from "./judge"

const recipe: DraftRequestRecipe = {
  name: ovenSource.name,
  description: "",
  servings: 4,
  method: "oven",
  ingredients: ovenSource.ingredients.map(line => line.text),
  steps: ovenSource.steps,
  notes: [],
  prepMinutes: 15,
  cookMinutes: 75,
  totalMinutes: 90,
  waitingNote: null,
}

describe("judgeContent", () => {
  it("caches everything before the draft for an hour, so each recipe's later drafts reuse it", () => {
    const [shared, draft] = judgeContent(recipe, "airFryer", goodAirFryerDraft, "1. Air fry.")
    expect(shared.cache_control).toEqual({ type: "ephemeral", ttl: "1h" })
    expect(shared.text).toContain("<original>")
    expect(shared.text).toContain("<reference>\n1. Air fry.\n</reference>")
    expect(shared.text).not.toContain(goodAirFryerDraft.name)
    expect(draft).not.toHaveProperty("cache_control")
    expect(draft.text).toContain(goodAirFryerDraft.name)
  })

  it("keeps the same text as the plain prompt the Gemini judge gets", () => {
    const [shared, draft] = judgeContent(recipe, "airFryer", goodAirFryerDraft)
    expect(`${shared.text}\n${draft.text}`).toBe(judgePrompt(recipe, "airFryer", goodAirFryerDraft))
  })
})
