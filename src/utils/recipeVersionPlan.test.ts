import { describe, expect, it } from "vitest"

import { householdAppliance } from "./householdAppliances"
import { type PlanStage, planCookMinutes, planTimes, validatePlan } from "./recipeVersionPlan"

const stage = (overrides: Partial<PlanStage>): PlanStage => ({
  zone: null,
  function: "Air Fry",
  setting: "190°C",
  minutes: 20,
  alongsidePrevious: false,
  what: "chicken",
  ...overrides,
})

describe("validatePlan", () => {
  const airFryer = householdAppliance("airFryer")
  const slowCooker = householdAppliance("slowCooker")

  it("accepts settings within the appliance's limits", () => {
    expect(
      validatePlan(
        [
          stage({ zone: "Zone 1", minutes: 25 }),
          stage({
            zone: "Zone 2",
            function: "Max Crisp",
            setting: "240°C",
            minutes: 15,
            alongsidePrevious: true,
          }),
        ],
        airFryer
      )
    ).toEqual([])
    expect(
      validatePlan(
        [
          stage({ function: "Sear/Sauté", setting: "HI", minutes: 10 }),
          stage({ function: "Slow Cook", setting: "LO", minutes: 420 }),
        ],
        slowCooker
      )
    ).toEqual([])
  })

  it.each([
    [
      stage({ function: "Slow Cook", setting: "LO", minutes: 240 }),
      /Slow Cook LO for 240 min is outside 360–720/,
    ],
    [
      stage({ function: "Slow Cook", setting: null, minutes: 240 }),
      /needs one of these settings: LO, HI/,
    ],
    [stage({ function: "Braise", setting: null, minutes: 30 }), /shorter than its 60 min minimum/],
    [
      stage({ function: "Bake", setting: "250°C", minutes: 30 }),
      /Bake at 250°C is outside 120–230°C/,
    ],
    [stage({ function: "Simmer", setting: "120°C", minutes: 10 }), /fixed at 99°C/],
  ])("rejects an impossible slow cooker stage %#", (bad, message) => {
    expect(validatePlan([bad], slowCooker).join(" ")).toMatch(message)
  })

  it.each([
    [stage({ function: "Air Fry", minutes: 75 }), /longer than its 60 min maximum/],
    [stage({ function: "Max Crisp", setting: "200°C", minutes: 10 }), /fixed at 240°C/],
    [stage({ minutes: 0 }), /needs a positive time/],
    [stage({ alongsidePrevious: true }), /first stage/],
  ])("rejects an impossible air fryer stage %#", (bad, message) => {
    expect(validatePlan([bad], airFryer).join(" ")).toMatch(message)
  })

  it("ignores steps outside the appliance, such as the hob or a resting time", () => {
    expect(
      validatePlan([stage({ function: "Hob", setting: "medium", minutes: 15 })], airFryer)
    ).toEqual([])
    expect(
      validatePlan([stage({ function: "Oven", setting: "200°C", minutes: 15 })], null)
    ).toEqual([])
  })
})

describe("planTimes", () => {
  it("counts zones running alongside each other once, by the longest", () => {
    const stages = [
      stage({ function: "Hob", minutes: 10 }),
      stage({ zone: "Zone 1", minutes: 35 }),
      stage({ zone: "Zone 2", minutes: 20, alongsidePrevious: true }),
      stage({ zone: "Zone 1", minutes: 5 }),
    ]
    expect(planCookMinutes(stages)).toBe(50)
    expect(planTimes(stages, 15, 30)).toEqual({
      prepMinutes: 15,
      cookMinutes: 50,
      totalMinutes: 95,
    })
  })

  it("handles an empty plan", () => {
    expect(planCookMinutes([])).toBe(0)
  })
})
