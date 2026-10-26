import { describe, expect, it } from "vitest"

import { drafterEnvironment, parseDrafter, parseDrafters } from "./drafters"

describe("parseDrafter", () => {
  it("reads Gemini levels, Claude models and efforts", () => {
    expect(parseDrafter("gemini:low")).toEqual({
      label: "gemini low",
      provider: "gemini",
      model: null,
      setting: "low",
    })
    expect(parseDrafter("gemini").label).toBe("gemini default")
    expect(parseDrafter(" claude-sonnet-5-5 ")).toEqual({
      label: "claude-sonnet-5-5",
      provider: "claude",
      model: "claude-sonnet-5-5",
      setting: null,
    })
    expect(parseDrafter("claude-opus-5-5:low")).toMatchObject({
      label: "claude-opus-5-5 low",
      setting: "low",
    })
  })

  it("rejects unknown drafters, and settings", () => {
    expect(() => parseDrafter("gpt-9")).toThrow(/Unknown drafter/)
    expect(() => parseDrafter("claude-haiku-5-5:turbo")).toThrow(/Unknown Claude effort/)
    expect(() => parseDrafter("gemini:extreme")).toThrow(/Unknown Gemini thinking level/)
  })
})

describe("parseDrafters", () => {
  it("adds Haiku, Sonnet and Opus only when there's a Claude key", () => {
    expect(parseDrafters(undefined, false)).toHaveLength(3)
    expect(
      parseDrafters(undefined, true)
        .map(d => d.label)
        .slice(3)
    ).toEqual(["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"])
  })
})

describe("drafterEnvironment", () => {
  it("points production settings at the drafter", () => {
    expect(drafterEnvironment(parseDrafter("gemini:low"), "gemini-3.8-flash")).toEqual({
      RECIPE_VERSION_MODEL: "gemini-3.8-flash",
      GEMINI_THINKING_LEVEL: "low",
      CLAUDE_EFFORT: undefined,
    })
    expect(drafterEnvironment(parseDrafter("claude-sonnet-5-5:high"), "gemini-3.8-flash")).toEqual({
      RECIPE_VERSION_MODEL: "claude-sonnet-5-5",
      GEMINI_THINKING_LEVEL: undefined,
      CLAUDE_EFFORT: "high",
    })
  })
})
