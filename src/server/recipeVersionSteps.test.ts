import { describe, expect, it } from "vitest"

import { goodAirFryerDraft } from "../test/fixtures/recipeVersionDrafts"
import { householdAppliance } from "../utils/householdAppliances"
import {
  durationsInText,
  type StructuredDraft,
  type TaggedStep,
  tagFindings,
  toDraft,
} from "./recipeVersionSteps"

const step = (overrides: Partial<TaggedStep>): TaggedStep => ({
  text: "Zone 1: Air Fry at 190°C for 20 minutes.",
  zone: "Zone 1",
  function: "Air Fry",
  setting: "190°C",
  minutes: 20,
  alongsidePrevious: false,
  ...overrides,
})

describe("durationsInText", () => {
  it("reads minutes, hours, ranges and halves", () => {
    expect(durationsInText("Air fry for 8–10 minutes")).toEqual([[8, 10]])
    expect(durationsInText("Slow Cook on LO for 7 hours")).toEqual([[420, 420]])
    expect(durationsInText("Cook for 1 hour 30 minutes")).toEqual([[90, 90]])
    expect(durationsInText("Braise for 2½ hours")).toEqual([[150, 150]])
    expect(durationsInText("Season well")).toEqual([])
  })
})

describe("toDraft", () => {
  it("works out cook and total time from the tagged steps", () => {
    const structured: StructuredDraft = {
      ...goodAirFryerDraft,
      prepMinutes: 15,
      waitingMinutes: 10,
      steps: [
        step({
          text: "Season the chicken.",
          function: null,
          setting: null,
          minutes: null,
          zone: null,
        }),
        step({ minutes: 25 }),
        step({
          zone: "Zone 2",
          text: "Zone 2: Air Fry at 190°C for 15 minutes.",
          minutes: 15,
          alongsidePrevious: true,
        }),
        step({ text: "Zone 1: Air Fry at 200°C for 5 minutes.", setting: "200°C", minutes: 5 }),
      ],
    }
    const draft = toDraft(structured)
    expect(draft.steps).toHaveLength(4)
    expect(draft.cookMinutes).toBe(30)
    expect(draft.totalMinutes).toBe(55)
  })
})

describe("tagFindings", () => {
  const slowCooker = householdAppliance("slowCooker")

  it("locates limit breaks and text that disagrees with the tags", () => {
    const findings = tagFindings(
      [
        step({
          text: "Brown the beef on Sear/Sauté HI for 10 minutes.",
          function: "Sear/Sauté",
          setting: "HI",
          minutes: 10,
          zone: "pot",
        }),
        step({
          text: "Slow Cook on LO for 4 hours.",
          function: "Slow Cook",
          setting: "LO",
          minutes: 240,
          zone: "pot",
        }),
        step({
          text: "Slow Cook on HI for 3 hours.",
          function: "Slow Cook",
          setting: "HI",
          minutes: 240,
          zone: "pot",
        }),
        step({
          text: "Slow Cook for 6 hours.",
          function: "Slow Cook",
          setting: "LO",
          minutes: 360,
          zone: "pot",
        }),
      ],
      slowCooker
    )
    expect(findings.map(finding => [finding.step, finding.message])).toEqual([
      [2, "Step 2: Slow Cook LO for 240 min is outside 360–720 min."],
      [3, "Step 3 is tagged 240 min, but the text gives a different time."],
      [4, "Step 4 is tagged LO, but the text doesn't say so."],
    ])
  })

  it("accepts a step whose text matches its tags", () => {
    expect(tagFindings([step({})], householdAppliance("airFryer"))).toEqual([])
  })
})
