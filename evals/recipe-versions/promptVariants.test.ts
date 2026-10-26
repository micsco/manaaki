import { describe, expect, it } from "vitest"

import { PROMPT_VERSIONS } from "../../src/server/recipeVersionAi"
import { isPromptVariant, withVariants } from "./promptVariants"

describe("withVariants", () => {
  it("gives the shipped v3 prompt for v2 plus the carry rules, as tested in the eval", () => {
    expect(withVariants(PROMPT_VERSIONS.v2, ["carry"])).toBe(PROMPT_VERSIONS.v3)
  })

  it("appends each rule set after the system prompt in order", () => {
    const system = withVariants("System", ["liquid", "load"])
    expect(system.startsWith("System\n\nLiquids:")).toBe(true)
    expect(system.indexOf("Capacity:")).toBeGreaterThan(system.indexOf("Liquids:"))
  })
})

describe("isPromptVariant", () => {
  it("knows the rule sets by name", () => {
    expect(isPromptVariant("carry")).toBe(true)
    expect(isPromptVariant("toString")).toBe(false)
  })
})
