import { describe, expect, it } from "vitest"

import { draftWith, goodAirFryerDraft, ovenSource } from "../test/fixtures/recipeVersionDrafts"
import { blockingChecks, checkDraft } from "./recipeVersionDraft"

const ids = (draft = goodAirFryerDraft, names: string[] = []) =>
  checkDraft(draft, ovenSource, "airFryer", names).map(check => check.id)

describe("checkDraft", () => {
  it("passes a sound air fryer draft", () => {
    expect(checkDraft(goodAirFryerDraft, ovenSource, "airFryer")).toEqual([])
  })

  it.each([
    ["name-missing", draftWith({ name: "  " })],
    ["steps-missing", draftWith({ steps: [" "] })],
    [
      "ingredient-unknown",
      draftWith({ ingredientChanges: [{ index: 9, quantity: 1, remove: false, reason: "x" }] }),
    ],
    [
      "ingredient-duplicate",
      draftWith({
        ingredientChanges: [
          { index: 1, quantity: 1, remove: false, reason: "less" },
          { index: 1, quantity: null, remove: true, reason: "none" },
        ],
      }),
    ],
    [
      "ingredient-reason",
      draftWith({ ingredientChanges: [{ index: 1, quantity: 1, remove: false, reason: " " }] }),
    ],
    [
      "ingredient-quantity",
      draftWith({ ingredientChanges: [{ index: 1, quantity: -1, remove: false, reason: "x" }] }),
    ],
    [
      "ingredient-unparsed",
      draftWith({ ingredientChanges: [{ index: 4, quantity: 2, remove: false, reason: "x" }] }),
    ],
    ["ingredient-new-empty", draftWith({ newIngredients: [{ text: " ", reason: "x" }] })],
    ["ingredient-new-reason", draftWith({ newIngredients: [{ text: "spray oil", reason: "" }] })],
    ["times-invalid", draftWith({ prepMinutes: Number.NaN })],
    ["total-missing", draftWith({ prepMinutes: 0, cookMinutes: 10, totalMinutes: 0 })],
    ["total-short", draftWith({ cookMinutes: 55, totalMinutes: 40 })],
    ["markup", draftWith({ steps: ["Air fry <script>alert(1)</script>"] })],
    ["markup", draftWith({ notes: [{ title: "", text: "[x](javascript:alert(1))" }] })],
  ])("blocks %s", (id, draft) => {
    const checks = checkDraft(draft, ovenSource, "airFryer")
    expect(blockingChecks(checks).map(check => check.id)).toContain(id)
  })

  it("doesn't mistake ordinary words ending in data: for a data link", () => {
    const draft = draftWith({ notes: [{ title: "", text: "Nutrition data: per serving." }] })
    expect(ids(draft)).not.toContain("markup")
    expect(ids(draftWith({ notes: [{ title: "", text: "data:text/html,hi" }] }))).toContain(
      "markup"
    )
  })

  it("allows removing an unparsed line", () => {
    const draft = draftWith({
      ingredientChanges: [{ index: 4, quantity: null, remove: true, reason: "Not needed" }],
    })
    expect(blockingChecks(checkDraft(draft, ovenSource, "airFryer"))).toEqual([])
  })

  it.each([
    [
      "ingredient-ratio",
      draftWith({
        ingredientChanges: [{ index: 2, quantity: 900, remove: false, reason: "more" }],
      }),
    ],
    ["cook-range", draftWith({ cookMinutes: 120, totalMinutes: 140 })],
    [
      "fahrenheit",
      draftWith({ steps: [...goodAirFryerDraft.steps, "Air fry at 375°F if your dial is in F."] }),
    ],
    [
      "temperature-range",
      draftWith({ steps: ["Heat the air fryer to 240°C.", ...goodAirFryerDraft.steps.slice(1)] }),
    ],
    [
      "target-missing",
      draftWith({
        steps: goodAirFryerDraft.steps.map(s => s.replaceAll(/air fry(er)?/gi, "cook")),
      }),
    ],
    [
      "source-leftover",
      draftWith({ steps: ["Preheat the oven to 200°C.", ...goodAirFryerDraft.steps] }),
    ],
    [
      "doneness-dropped",
      draftWith({
        steps: goodAirFryerDraft.steps.map(s =>
          s.replace(" and the chicken is piping hot and cooked through", "")
        ),
      }),
    ],
    ["step-count", draftWith({ steps: [goodAirFryerDraft.steps.join(" ")] })],
    ["name-label", draftWith({ name: "BBQ Chicken Twice-Baked Potatoes" })],
    ["low-confidence", draftWith({ confidence: "low" })],
  ])("warns %s", (id, draft) => {
    const checks = checkDraft(draft, ovenSource, "airFryer")
    expect(checks.find(check => check.id === id)?.level).toBe("warn")
  })

  it("warns when the name is already taken, ignoring case", () => {
    expect(ids(goodAirFryerDraft, ["bbq chicken twice-baked potatoes (AIR FRYER)"])).toContain(
      "name-taken"
    )
  })

  it("asks slow cooker drafts to say LOW or HIGH", () => {
    const draft = draftWith({
      name: "Stew (Slow cooker)",
      cookMinutes: 360,
      totalMinutes: 380,
      steps: ["Put everything in the slow cooker.", "Cook for 6 hours.", "Serve hot."],
    })
    expect(checkDraft(draft, ovenSource, "slowCooker").map(check => check.id)).toContain(
      "slow-cooker-setting"
    )
  })
})
