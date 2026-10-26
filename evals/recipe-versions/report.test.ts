import { describe, expect, it } from "vitest"

import { goodAirFryerDraft } from "../../src/test/fixtures/recipeVersionDrafts"
import type { JudgeVerdict } from "./judge"
import { type EvalRun, escapeHtml, mean, median, renderReport, summarise } from "./report"

const verdict = (overall: number): JudgeVerdict => ({
  overall,
  issues: overall < 4 ? ["Chips and fish finish at different times"] : [],
  scores: {
    appliance: overall,
    temperatures: overall,
    timings: overall,
    foodSafety: 5,
    completeness: overall,
    clarity: overall,
  },
})

const run = (drafter: string, overrides: Partial<EvalRun> = {}): EvalRun => ({
  slug: "sweet-chilli-fish-chips-traybake",
  name: "Sweet chilli fish & chips traybake",
  target: "airFryer",
  drafter,
  repeat: 0,
  draft: goodAirFryerDraft,
  checks: [{ id: "temperature-range", level: "warn", message: "63°C is outside the range" }],
  verdict: verdict(4),
  usage: {
    inputTokens: 1400,
    outputTokens: 600,
    thinkingTokens: 0,
    firstChunkMs: 3000,
    firstTokenMs: 3000,
    modelMs: 8000,
  },
  ...overrides,
})

describe("median and mean", () => {
  it("handle odd, even and empty lists", () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(median([])).toBeNull()
    expect(mean([1, 2, 3])).toBe(2)
    expect(mean([])).toBeNull()
  })
})

describe("summarise", () => {
  it("compares levels on time, thinking, checks and judge scores, counting failures", () => {
    const runs = [
      run("low"),
      run("low", { repeat: 1, verdict: verdict(2) }),
      run("high", {
        usage: {
          inputTokens: 1400,
          outputTokens: 600,
          thinkingTokens: 3000,
          firstChunkMs: 3000,
          firstTokenMs: 30000,
          modelMs: 36000,
        },
        verdict: verdict(5),
        checks: [],
      }),
      run("high", {
        repeat: 1,
        error: "The AI took too long.",
        draft: undefined,
        usage: undefined,
        verdict: undefined,
      }),
    ]
    const [low, high] = summarise(runs, ["low", "high"])
    expect(low).toMatchObject({
      drafts: 2,
      failures: 0,
      warnings: 2,
      medianModelMs: 8000,
      meanOverall: 3,
    })
    expect(low.meanScores.foodSafety).toBe(5)
    expect(high).toMatchObject({
      drafts: 2,
      failures: 1,
      warnings: 0,
      medianThinkingTokens: 3000,
      meanOverall: 5,
    })
  })
})

describe("costs", () => {
  it("averages cost only when every successful draft has one", () => {
    const [claude] = summarise(
      [run("claude", { costUsd: 0.01 }), run("claude", { repeat: 1, costUsd: 0.03 })],
      ["claude"]
    )
    expect(claude.meanCostUsd).toBeCloseTo(0.02)
  })
})

describe("renderReport", () => {
  it("escapes recipe and model text", () => {
    expect(escapeHtml('<script>"x" & y</script>')).toBe(
      "&lt;script&gt;&quot;x&quot; &amp; y&lt;/script&gt;"
    )
    const html = renderReport(
      [run("low", { draft: { ...goodAirFryerDraft, steps: ["<img src=x onerror=alert(1)>"] } })],
      ["low"],
      { model: "gemini-3.8-flash" }
    )
    expect(html).not.toContain("<img src=x")
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;")
  })

  it("lays out each recipe with a column per level, including failures", () => {
    const html = renderReport(
      [
        run("low"),
        run("medium", { error: "The AI took too long.", draft: undefined, usage: undefined }),
      ],
      ["low", "medium"],
      { model: "m" }
    )
    expect(html).toContain("Sweet chilli fish &amp; chips traybake → airFryer")
    expect(html).toContain("Failed: The AI took too long.")
    expect(html).toContain("4/5")
    expect(html).toContain("63°C is outside the range")
  })
})
