import { describe, expect, it } from "vitest"

import { costOf, PRICES } from "./prices"

const usage = {
  inputTokens: 3000,
  outputTokens: 1000,
  thinkingTokens: 0,
  firstChunkMs: null,
  firstTokenMs: null,
  modelMs: 0,
}

describe("costOf", () => {
  const opus = PRICES["claude-opus-5-5"].current

  it("charges every input token at the full price when nothing is cached", () => {
    expect(costOf(opus, usage)).toBeCloseTo((3000 * 4 + 1000 * 20) / 1_000_000)
  })

  it("prices cache reads, 5-minute writes and 1-hour writes separately", () => {
    expect(
      costOf(opus, {
        ...usage,
        cachedInputTokens: 1500,
        cacheWriteTokens: 1000,
        cacheWrite1hTokens: 400,
      })
    ).toBeCloseTo((500 * 4 + 1500 * 0.2 + 600 * 5 + 400 * 8 + 1000 * 20) / 1_000_000)
  })

  it("charges Gemini's cached input at a tenth", () => {
    const flash = PRICES["gemini-3.8-flash"].current
    expect(costOf(flash, { ...usage, cachedInputTokens: 3000 })).toBeCloseTo(
      (3000 * 0.075 + 1000 * 3.75) / 1_000_000
    )
  })

  it("falls back to the full input price when a model has no cache prices", () => {
    const lite = PRICES["gemini-3.5-flash-lite"].current
    expect(costOf(lite, { ...usage, cachedInputTokens: 3000 })).toBeCloseTo(
      (3000 * 0.3 + 1000 * 2.5) / 1_000_000
    )
  })
})
