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
      draftWith({ steps: ["Heat the air fryer to 260°C.", ...goodAirFryerDraft.steps.slice(1)] }),
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

  it.each([
    "Cook until the chicken reaches an internal temperature of 75°C.",
    "Check the core temperature is 75°C with a thermometer.",
    "Air fry until the fish flakes easily (63°C internal).",
    "Cook until the basa is opaque and 63°C in the thickest part.",
    "Bake until the salmon is 63°C inside.",
    "Cook to a safe 63°C.",
    "Check that the chicken reaches an internal temperature of at least 75°C and the juices run clear.",
    "A thermometer in the thickest part of the thigh (avoiding the bone) should register at least 74°C.",
  ])("doesn't treat a food temperature as an appliance setting: %s", step => {
    const draft = draftWith({ steps: [...goodAirFryerDraft.steps, step] })
    expect(ids(draft)).not.toContain("temperature-range")
  })

  it("still checks an appliance temperature written after a doneness phrase", () => {
    const draft = draftWith({
      steps: [
        ...goodAirFryerDraft.steps,
        "Air fry until the chicken reaches 75°C inside, then crisp everything at 260°C for 5 minutes.",
      ],
    })
    expect(ids(draft)).toContain("temperature-range")
  })

  it("counts zones and drawers as mentioning the air fryer", () => {
    const draft = draftWith({
      steps: [
        "Divide the potatoes between both drawers.",
        "Zone 1: Roast at 190°C for 25 minutes, then check the chicken is cooked through.",
        "Serve.",
      ],
    })
    expect(ids(draft)).not.toContain("target-missing")
  })

  it("still checks a low temperature on a low-heat function", () => {
    const draft = draftWith({
      steps: [
        ...goodAirFryerDraft.steps,
        "Zone 2: Dehydrate the apple slices at 30°C for 6 hours.",
      ],
    })
    expect(ids(draft)).toContain("temperature-range")
  })

  it("allows a Fahrenheit conversion in brackets after °C", () => {
    const draft = draftWith({
      steps: [
        ...goodAirFryerDraft.steps,
        "The thigh should read 74°C (165°F) in the thickest part.",
      ],
    })
    expect(ids(draft)).not.toContain("fahrenheit")
  })

  it("accepts Max Crisp at 240°C", () => {
    const draft = draftWith({
      steps: [...goodAirFryerDraft.steps, "Zone 2: Max Crisp the chips at 240°C for 20 minutes."],
    })
    expect(ids(draft)).not.toContain("temperature-range")
  })

  it("warns when the name is already taken, ignoring case", () => {
    expect(ids(goodAirFryerDraft, ["bbq chicken twice-baked potatoes (AIR FRYER)"])).toContain(
      "name-taken"
    )
  })

  it("accepts Ninja's Low and Hi setting names", () => {
    const draft = draftWith({
      name: "Stew (Slow cooker)",
      cookMinutes: 360,
      totalMinutes: 380,
      steps: ["Brown the beef with Sear/Sauté.", "Slow Cook on Hi for 6 hours.", "Serve."],
    })
    const ids = checkDraft(draft, ovenSource, "slowCooker").map(check => check.id)
    expect(ids).not.toContain("slow-cooker-setting")
    expect(ids).not.toContain("target-missing")
  })

  it.each(["Slow Cook on LO for 7 hours.", "Braise for 3 hours."])(
    "accepts the PossibleCooker's own settings: %s",
    step => {
      const draft = draftWith({
        name: "Stew (Slow cooker)",
        cookMinutes: 360,
        totalMinutes: 380,
        steps: ["Sear the beef in the slow cooker pot.", step, "Serve."],
      })
      expect(checkDraft(draft, ovenSource, "slowCooker").map(check => check.id)).not.toContain(
        "slow-cooker-setting"
      )
    }
  )

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

describe("slow cooker limits", () => {
  const slowDraft = (step: string) =>
    draftWith({
      name: "Stew (Slow cooker)",
      cookMinutes: 400,
      totalMinutes: 420,
      steps: ["Brown the beef with Sear/Sauté on HI.", step, "Serve."],
    })
  const blocks = (step: string) =>
    blockingChecks(checkDraft(slowDraft(step), ovenSource, "slowCooker")).map(
      check => check.message
    )

  it.each([
    ["Slow Cook on LO for 3 hours.", /LO for 3 h isn't possible/],
    ["Slow Cook on LO for 5 hours, until tender.", /LO for 5 h/],
    ["Slow Cook on HI for 2½ hours.", /HI for 2 h 30 min/],
    ["Slow Cook on HI for 90 minutes.", /HI for 1 h 30 min/],
    ["Slow Cook on LOW for 1 hour 30 minutes.", /LO for 1 h 30 min/],
  ])("blocks %s", (step, message) => {
    expect(blocks(step).join(" ")).toMatch(message)
  })

  it.each([
    "Slow Cook on LO for 7 hours.",
    "Slow Cook on HI for 3 hours, or LO for 6 hours.",
    "Sear/Sauté on HI for 5 minutes, then stir in the paste.",
    "Braise for 2 hours.",
  ])("allows %s", step => {
    expect(blocks(step)).toEqual([])
  })

  it("counts Sear/Sauté and Braise as using the slow cooker", () => {
    const draft = draftWith({
      name: "Stew (Slow cooker)",
      cookMinutes: 140,
      totalMinutes: 160,
      steps: ["Brown the beef with Sear/Sauté on HI.", "Braise for 2 hours.", "Serve."],
    })
    expect(checkDraft(draft, ovenSource, "slowCooker").map(check => check.id)).not.toContain(
      "target-missing"
    )
  })
})

describe("doneness cues", () => {
  it.each([
    "Air fry until the fish flakes easily.",
    "Cook until the cod is opaque in the centre.",
    "Cook until the chicken reads 75°C.",
  ])("counts %s as keeping a doneness check", step => {
    const draft = draftWith({
      steps: goodAirFryerDraft.steps.map((text, index) =>
        index === 2 ? `Spoon the filling back in and air fry for 8 minutes. ${step}` : text
      ),
    })
    expect(ids(draft)).not.toContain("doneness-dropped")
  })
})
