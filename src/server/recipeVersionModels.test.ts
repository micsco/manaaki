import { beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"

import {
  createDraftingModel,
  ModelBusyError,
  ModelCallError,
  modelConfig,
} from "./recipeVersionModels"

const chat = vi.hoisted(() => vi.fn())
vi.mock("@tanstack/ai", () => ({ chat }))
vi.mock("@tanstack/ai-gemini", () => ({
  createGeminiChat: vi.fn((model: string) => ({ gemini: model })),
}))
vi.mock("@tanstack/ai-anthropic", () => ({
  createAnthropicChat: vi.fn((model: string) => ({ claude: model })),
}))

const schema = z.object({
  steps: z.array(z.string()).min(1),
  quantity: z.number().positive().nullable(),
})

function streamOf(...chunks: Record<string, unknown>[]) {
  return (async function* () {
    for (const chunk of chunks) yield chunk
  })()
}

const done = (object: unknown, usage: Record<string, unknown> = {}) => [
  { type: "CUSTOM", name: "structured-output.complete", value: { object } },
  { type: "RUN_FINISHED", usage },
]

beforeEach(() => chat.mockReset())

describe("createDraftingModel", () => {
  it("streams reasoning and text to the hooks and reports Gemini usage", async () => {
    chat.mockReturnValue(
      streamOf(
        { type: "RUN_STARTED" },
        { type: "REASONING_MESSAGE_CONTENT", delta: "**Planning**" },
        { type: "TEXT_MESSAGE_CONTENT", delta: '{"steps":["one"],' },
        ...done(
          { steps: ["one"], quantity: null },
          {
            promptTokens: 1000,
            completionTokens: 300,
            completionTokensDetails: { reasoningTokens: 700 },
          }
        )
      )
    )
    const onReasoning = vi.fn()
    const onText = vi.fn()
    const model = createDraftingModel(modelConfig("gemini-3.8-flash", "low"), "key")
    const result = await model.structured("system", "prompt", schema, { onReasoning, onText })
    expect(result.data).toEqual({ steps: ["one"], quantity: null })
    expect(onReasoning).toHaveBeenCalledWith("**Planning**")
    expect(onText).toHaveBeenCalledWith('{"steps":["one"],')
    expect(result.usage).toMatchObject({
      calls: 1,
      inputTokens: 1000,
      outputTokens: 300,
      thinkingTokens: 700,
    })
    expect(result.usage.firstTokenMs).toBeGreaterThanOrEqual(0)
    const options = chat.mock.calls[0][0]
    expect(options).toMatchObject({
      systemPrompts: ["system"],
      messages: [{ role: "user", content: "prompt" }],
      stream: true,
      modelOptions: { maxOutputTokens: 32000 },
      reasoning: { level: "low", summary: true },
    })
    expect(JSON.stringify(options.outputSchema)).not.toMatch(
      /\$defs|exclusiveMinimum|additionalProperties/
    )
  })

  it("passes the zod schema to Claude and leaves its thinking tokens unknown", async () => {
    chat.mockReturnValue(
      streamOf(...done({ steps: ["one"], quantity: 2 }, { promptTokens: 10, completionTokens: 20 }))
    )
    const model = createDraftingModel(modelConfig("claude-sonnet-5-5", null), "key")
    const result = await model.structured("system", "prompt", schema)
    expect(chat.mock.calls[0][0].outputSchema).toBe(schema)
    expect(chat.mock.calls[0][0]).not.toHaveProperty("reasoning")
    expect(chat.mock.calls[0][0].modelOptions).toEqual({ max_tokens: 32000 })
    expect(result.usage.thinkingTokens).toBeNull()
  })

  it.each([
    ["429 RESOURCE_EXHAUSTED", ModelBusyError],
    ["overloaded_error", ModelBusyError],
    ["400 invalid argument", ModelCallError],
  ])("maps a run error (%s)", async (message, errorClass) => {
    chat.mockReturnValue(streamOf({ type: "RUN_ERROR", message }))
    const model = createDraftingModel(modelConfig("gemini-3.8-flash", "low"), "key")
    await expect(model.structured("s", "p", schema)).rejects.toBeInstanceOf(errorClass)
  })

  it("rejects a missing or invalid structured result", async () => {
    const model = createDraftingModel(modelConfig("gemini-3.8-flash", "low"), "key")
    chat.mockReturnValue(streamOf({ type: "RUN_FINISHED" }))
    await expect(model.structured("s", "p", schema)).rejects.toThrow(/stopped before finishing/)
    chat.mockReturnValue(streamOf(...done({ steps: [], quantity: -1 })))
    await expect(model.structured("s", "p", schema)).rejects.toThrow(/incomplete draft/)
  })

  it("aborts the run when the caller's signal aborts", async () => {
    const caller = new AbortController()
    chat.mockImplementation((options: { abortController: AbortController }) =>
      (async function* () {
        caller.abort(new DOMException("gone", "AbortError"))
        expect(options.abortController.signal.aborted).toBe(true)
        yield { type: "RUN_FINISHED" }
      })()
    )
    const model = createDraftingModel(modelConfig("gemini-3.8-flash", "low"), "key")
    await expect(model.structured("s", "p", schema, { signal: caller.signal })).rejects.toThrow(
      "gone"
    )
  })
})
