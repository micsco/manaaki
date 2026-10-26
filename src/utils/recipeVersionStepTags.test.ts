import { describe, expect, it } from "vitest"

import type { StepTag } from "./recipeVersionDraft"
import {
  cookingPlan,
  formatMinutes,
  initialStepPlans,
  stepTagParts,
  visibleTag,
} from "./recipeVersionStepTags"

const airFry: StepTag = {
  zone: "Zone 2",
  function: "Air Fry",
  setting: "190°C",
  minutes: 10,
  alongsidePrevious: true,
}
const prep: StepTag = {
  zone: null,
  function: null,
  setting: null,
  minutes: null,
  alongsidePrevious: false,
}

describe("formatMinutes", () => {
  it("uses hours once a stage reaches an hour", () => {
    expect(formatMinutes(45)).toBe("45 min")
    expect(formatMinutes(480)).toBe("8 h")
    expect(formatMinutes(90)).toBe("1 h 30 min")
  })
})

describe("stepTagParts", () => {
  it("lists the zone, function, setting and time that are set", () => {
    expect(stepTagParts(airFry)).toEqual(["Zone 2", "Air Fry", "190°C", "10 min"])
    expect(stepTagParts(prep)).toEqual([])
  })
})

describe("visibleTag", () => {
  const plan = { tag: airFry, written: "Air fry for 10 minutes." }

  it("keeps a tag while the text is unchanged or still gives its time", () => {
    expect(visibleTag(plan, "Air fry for 10 minutes.")).toBe(airFry)
    expect(visibleTag(plan, "Air fry the fish for 10 min until flaky.")).toBe(airFry)
    expect(
      visibleTag({ tag: { ...airFry, minutes: 480 }, written: "x" }, "Cook for 8 hours.")
    ).toEqual(expect.objectContaining({ minutes: 480 }))
  })

  it("hides a tag once an edit changes the time", () => {
    expect(visibleTag(plan, "Air fry for 14 minutes.")).toBeNull()
    expect(visibleTag(null, "Anything")).toBeNull()
  })
})

describe("initialStepPlans", () => {
  it("pairs tags with steps, or drops them when the counts differ", () => {
    expect(initialStepPlans(["a", "b"], [airFry, prep])).toEqual([
      { tag: airFry, written: "a" },
      { tag: prep, written: "b" },
    ])
    expect(initialStepPlans(["a", "b"], [airFry])).toEqual([null, null])
  })
})

describe("cookingPlan", () => {
  it("lists the timed steps in order, marking those that run alongside the previous one", () => {
    const steps = ["Mix.", "Air fry the chips for 22 minutes.", "Air fry the fish for 10 minutes."]
    const plans = initialStepPlans(steps, [
      prep,
      { ...airFry, zone: "Zone 1", minutes: 22, alongsidePrevious: false },
      airFry,
    ])
    expect(cookingPlan(steps, plans)).toEqual([
      { step: 2, parts: ["Zone 1", "Air Fry", "190°C", "22 min"], alongsidePrevious: false },
      { step: 3, parts: ["Zone 2", "Air Fry", "190°C", "10 min"], alongsidePrevious: true },
    ])
  })
})
