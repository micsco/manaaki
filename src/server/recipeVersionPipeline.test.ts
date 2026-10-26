import { describe, expect, it, vi } from "vitest"

import { goodAirFryerDraft, ovenSource } from "../test/fixtures/recipeVersionDrafts"
import type { CallUsage, DraftingModel, StreamHooks } from "./recipeVersionModels"
import {
  applyPatch,
  patchPrompt,
  problemsOf,
  runRecipeVersionPipeline,
} from "./recipeVersionPipeline"
import type { StructuredDraft, TaggedStep } from "./recipeVersionSteps"

const usage = (): CallUsage => ({
  calls: 1,
  inputTokens: 100,
  outputTokens: 50,
  thinkingTokens: 0,
  ms: 10,
  firstChunkMs: 1,
  firstTokenMs: 2,
})

const step = (overrides: Partial<TaggedStep>): TaggedStep => ({
  text: "Brown the beef on Sear/Sauté HI for 10 minutes, until cooked through.",
  zone: "pot",
  function: "Sear/Sauté",
  setting: "HI",
  minutes: 10,
  alongsidePrevious: false,
  ...overrides,
})

const slow = (text: string, setting: string, minutes: number) =>
  step({ text, function: "Slow Cook", setting, minutes })

function structured(steps: TaggedStep[]): StructuredDraft {
  const { steps: _steps, cookMinutes: _cook, totalMinutes: _total, ...rest } = goodAirFryerDraft
  return { ...rest, name: "Stew (Slow cooker)", steps, prepMinutes: 15, waitingMinutes: 0 }
}

const good = structured([step({}), slow("Slow Cook on LO for 7 hours, until tender.", "LO", 420)])
const bad = structured([step({}), slow("Slow Cook on LO for 4 hours, until tender.", "LO", 240)])

function fakeModel(
  responses: unknown[],
  name = "gemini-3.8-flash"
): DraftingModel & { prompts: string[] } {
  const prompts: string[] = []
  return {
    config: { provider: "gemini", model: name, setting: "low" },
    prompts,
    async structured(_system: string, prompt: string, _schema: unknown, hooks?: StreamHooks) {
      prompts.push(prompt)
      hooks?.onReasoning?.("**Balancing the pot**\\n")
      hooks?.onText?.('{"steps":[{"text":"a"},')
      return { data: responses.shift() as never, usage: usage() }
    },
  }
}

const request = (
  draft: DraftingModel,
  escalate: DraftingModel | null = null,
  onProgress = vi.fn()
) =>
  runRecipeVersionPipeline({
    system: "system",
    prompt: "prompt",
    target: "slowCooker",
    source: ovenSource,
    draft,
    escalate,
    onProgress,
  })

const fixLo = {
  edits: [{ step: 2, replacement: slow("Slow Cook on LO for 7 hours, until tender.", "LO", 420) }],
  prepMinutes: null,
  waitingMinutes: null,
}

describe("runRecipeVersionPipeline", () => {
  it("returns a clean draft after one call, with times worked out from the tags", async () => {
    const onProgress = vi.fn()
    const outcome = await request(fakeModel([good]), null, onProgress)
    expect(outcome.usage.calls).toBe(1)
    expect(outcome.repairRan).toBe(false)
    expect(outcome.draft.cookMinutes).toBe(430)
    expect(outcome.draft.totalMinutes).toBe(445)
    expect(outcome.draft.steps[1]).toMatch(/LO for 7 hours/)
    expect(outcome.stepTags).toHaveLength(outcome.draft.steps.length)
    expect(outcome.stepTags[1]).toEqual({
      zone: good.steps[1].zone,
      function: good.steps[1].function,
      setting: good.steps[1].setting,
      minutes: good.steps[1].minutes,
      alongsidePrevious: good.steps[1].alongsidePrevious,
    })
    expect(onProgress.mock.calls.map(([event]) => event.stage)).toEqual([
      "thinking",
      "thinking",
      "writing",
    ])
  })

  it("patches only the failing step, then stops", async () => {
    const drafter = fakeModel([bad, fixLo])
    const onProgress = vi.fn()
    const outcome = await request(drafter, null, onProgress)
    expect(outcome).toMatchObject({
      initialProblems: 2,
      repairRan: true,
      repairFixed: true,
      escalated: false,
    })
    expect(outcome.usage.calls).toBe(2)
    expect(outcome.draft.steps[0]).toBe(good.steps[0].text)
    expect(outcome.draft.steps[1]).toMatch(/LO for 7 hours/)
    expect(onProgress).toHaveBeenCalledWith({ stage: "fixing", problems: 2, escalated: false })
    expect(drafter.prompts[1]).toContain("Slow Cook: LO 360–720 min, HI 180–720 min")
  })

  it("escalates when the first repair doesn't fix everything, and ignores a repair that makes no progress", async () => {
    const unhelpful = { edits: [], prepMinutes: null, waitingMinutes: null }
    const drafter = fakeModel([bad, unhelpful])
    const sonnet = fakeModel([fixLo], "claude-sonnet-5-5")
    const onProgress = vi.fn()
    const outcome = await request(drafter, sonnet, onProgress)
    expect(outcome).toMatchObject({
      repairRan: true,
      repairFixed: false,
      escalated: true,
      escalationFixed: true,
    })
    expect(outcome.usage.calls).toBe(3)
    expect(onProgress).toHaveBeenCalledWith({ stage: "fixing", problems: 2, escalated: true })
    expect(outcome.draft.steps[1]).toMatch(/LO for 7 hours/)
  })

  it("keeps the best draft when neither repair helps", async () => {
    const nothing = { edits: [], prepMinutes: null, waitingMinutes: null }
    const outcome = await request(fakeModel([bad, nothing]), fakeModel([nothing]))
    expect(outcome).toMatchObject({ repairFixed: false, escalated: true, escalationFixed: false })
    expect(outcome.draft.steps[1]).toMatch(/LO for 4 hours/)
  })
})

describe("patchPrompt and applyPatch", () => {
  it("shows only the failing steps and their neighbours when every problem is located", () => {
    const long = structured([
      step({}),
      step({ text: "Add the onions.", function: null, setting: null, minutes: null }),
      step({ text: "Add the stock.", function: null, setting: null, minutes: null }),
      slow("Slow Cook on LO for 4 hours.", "LO", 240),
      step({ text: "Serve.", function: null, setting: null, minutes: null }),
    ])
    const problems = { located: problemsOf(long, "slowCooker", ovenSource).located, general: [] }
    const prompt = patchPrompt(long, problems, "slowCooker")
    expect(prompt).toContain("only the relevant ones are shown")
    expect(prompt).toContain("Step 3:")
    expect(prompt).toContain("Step 4:")
    expect(prompt).toContain("Step 5:")
    expect(prompt).not.toContain("Step 1:")
  })

  it("replaces only the edited steps and ignores out-of-range step numbers", () => {
    const patched = applyPatch(bad, {
      edits: [...fixLo.edits, { step: 9, replacement: step({}) }],
      prepMinutes: 20,
      waitingMinutes: null,
    })
    expect(patched.steps).toHaveLength(2)
    expect(patched.steps[0]).toBe(bad.steps[0])
    expect(patched.prepMinutes).toBe(20)
    expect(patched.waitingMinutes).toBe(0)
  })
})
