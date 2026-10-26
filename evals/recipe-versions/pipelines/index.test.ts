import { describe, expect, it } from "vitest"

import { parsePipeline } from "./index"

describe("parsePipeline", () => {
  it("reads single, repair and structured pipelines, with an optional escalation model", () => {
    expect(parsePipeline("repair/gemini:low")).toMatchObject({
      kind: "repair",
      model: { provider: "gemini", model: "gemini-3.8-flash", setting: "low" },
      label: "repair gemini low",
    })
    expect(parsePipeline("structured/gemini:low>claude-sonnet-5-5")).toMatchObject({
      kind: "structured",
      model: { provider: "gemini", setting: "low" },
      escalate: { provider: "claude", model: "claude-sonnet-5-5" },
      label: "structured gemini low › sonnet",
    })
    expect(parsePipeline("structured/claude-haiku-5-5")).toMatchObject({
      escalate: null,
      label: "structured haiku",
    })
  })

  it("rejects unknown pipelines and models", () => {
    expect(() => parsePipeline("tools/gemini")).toThrow(/Unknown pipeline/)
    expect(() => parsePipeline("single/gpt-9")).toThrow(/Unknown model/)
  })
})
