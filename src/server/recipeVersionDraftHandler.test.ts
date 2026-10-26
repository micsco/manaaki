import { ApiError } from "@google/genai"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { goodAirFryerDraft } from "../test/fixtures/recipeVersionDrafts"
import { installTestPostHog } from "../test/serverPostHog"
import { AiDraftError, AiNotConfiguredError, generateRecipeVersionDraft } from "./recipeVersionAi"
import { recipeVersionDraftHandler, resetDraftRateLimit } from "./recipeVersionDraftHandler"
import { traceRequest } from "./requestTracing"
import { buildSessionSetCookie } from "./session"
import { activeTraceId } from "./telemetry"

vi.mock("./recipeVersionAi", async importOriginal => ({
  ...(await importOriginal<typeof import("./recipeVersionAi")>()),
  generateRecipeVersionDraft: vi.fn(),
}))

const RECIPE_ID = "1135368a-1a28-4b47-a422-dbf9d3a7bbc0"
const recipe = {
  id: RECIPE_ID,
  slug: "bbq-chicken-twice-baked-potatoes",
  name: "BBQ Chicken Twice-Baked Potatoes",
  description: "",
  recipeServings: 4,
  tools: [],
  extras: {},
  recipeIngredient: [
    { display: "4 large baking potatoes", quantity: 4 },
    { display: "2 tbsp olive oil", quantity: 2, title: "Potatoes" },
  ],
  recipeInstructions: [{ text: "Preheat the oven to 200°C and bake for 1 hour." }],
  notes: [],
  prepTimeSeconds: 900,
  performTimeSeconds: 4500,
  totalTimeSeconds: 5400,
}

function cookie(): string {
  const value = buildSessionSetCookie("user-token", false)
    .split(";")[0]
    .split("=")
    .slice(1)
    .join("=")
  return `manaaki_session=${value}`
}

function post(body: unknown, headers: Record<string, string> = { cookie: cookie() }) {
  return recipeVersionDraftHandler(
    new Request("http://app/api/manaaki/recipe-versions/draft", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  )
}

function mealieReturns(status: number, body: unknown = recipe) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      })
  )
}

const valid = { recipeId: RECIPE_ID, target: "airFryer" }

async function events(response: Response) {
  return (await response.text())
    .split("\n")
    .filter(Boolean)
    .map(line => JSON.parse(line))
}

beforeEach(() => {
  process.env.MEALIE_INTERNAL_URL = "http://mealie:9000"
  process.env.SESSION_SECRET = "unit-test-secret"
  process.env.GEMINI_API_KEY = "super-secret-gemini-key"
  resetDraftRateLimit()
  vi.mocked(generateRecipeVersionDraft).mockResolvedValue({
    draft: goodAirFryerDraft,
    usage: {
      inputTokens: 1,
      outputTokens: 2,
      thinkingTokens: 3,
      model: "gemini-3.8-flash",
      thinkingLevel: "medium",
      connectMs: 30,
      firstTokenMs: 40,
      modelMs: 50,
    },
  })
  vi.spyOn(console, "info").mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.RECIPE_VERSION_DRAFTS_PER_HOUR
})

describe("recipeVersionDraftHandler", () => {
  it("returns the draft, checks and source for a signed-in cook", async () => {
    const fetchSpy = mealieReturns(200)
    const response = await post({ ...valid, notes: "small basket" })
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(response.headers.get("content-type")).toContain("application/x-ndjson")
    const sent = await events(response)
    expect(sent.map(event => event.stage ?? event.type)).toEqual(["checking", "result"])
    const body = sent.at(-1)
    expect(body.draft).toEqual(goodAirFryerDraft)
    expect(body.metrics).toMatchObject({
      model: "gemini-3.8-flash",
      inputTokens: 1,
      outputTokens: 2,
      thinkingTokens: 3,
      firstTokenMs: 40,
      modelMs: 50,
    })
    expect(body.metrics.totalMs).toBeGreaterThanOrEqual(0)
    expect(body.metrics.mealieMs).toBeGreaterThanOrEqual(0)
    expect(Array.isArray(body.checks)).toBe(true)
    expect(body.source.ingredients).toEqual([
      { text: "4 large baking potatoes", quantity: 4 },
      { text: "[Potatoes] 2 tbsp olive oil", quantity: 2 },
    ])
    const mealieRequest = new Request(fetchSpy.mock.calls[0][0])
    expect(mealieRequest.url).toContain(`/api/recipes/${RECIPE_ID}`)
    const [draftRecipe, target, notes] = vi.mocked(generateRecipeVersionDraft).mock.calls[0]
    expect(target).toBe("airFryer")
    expect(notes).toBe("small basket")
    expect(draftRecipe.method).toBe("oven")
    expect(draftRecipe.cookMinutes).toBe(75)
  })

  it("traces the draft and records its outcome, tokens and duration", async () => {
    const posthog = installTestPostHog()
    try {
      let traceIdSeenByModel: string | undefined
      vi.mocked(generateRecipeVersionDraft).mockImplementation(async () => {
        traceIdSeenByModel = activeTraceId()
        return {
          draft: goodAirFryerDraft,
          usage: {
            inputTokens: 1,
            outputTokens: 2,
            thinkingTokens: 3,
            model: "gemini-3.8-flash",
            thinkingLevel: "medium",
            connectMs: 30,
            firstTokenMs: 40,
            modelMs: 50,
          },
        }
      })
      mealieReturns(200)
      const draftRequest = new Request("http://app/api/manaaki/recipe-versions/draft", {
        method: "POST",
      })
      const { response } = await traceRequest(draftRequest, async () => ({
        response: await post(valid),
      }))
      await events(response)
      const requestSpan = posthog.span("POST /api/manaaki/recipe-versions/draft")!
      const span = posthog.span("recipe_version.draft")!
      expect(span.parentSpanId).toBe(requestSpan.spanId)
      expect(posthog.span("mealie")?.traceId).toBe(requestSpan.traceId)
      expect(traceIdSeenByModel).toBe(requestSpan.traceId)
      expect(span.attributes).toMatchObject({
        "recipe.id": RECIPE_ID,
        "recipe_version.target": "airFryer",
        "gen_ai.request.model": "gemini-3.8-flash",
        "gen_ai.usage.input_tokens": 1,
        "gen_ai.usage.output_tokens": 2,
        "recipe_version.thinking_tokens": 3,
        "recipe_version.confidence": goodAirFryerDraft.confidence,
      })
      const samples = await posthog.flushMetrics()
      expect(samples).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "recipe_version.drafts",
            attributes: {
              target: "airFryer",
              model: "gemini-3.8-flash",
              outcome: "ok",
              status: "200",
            },
          }),
          expect.objectContaining({
            name: "recipe_version.draft.duration",
            unit: "ms",
            attributes: { target: "airFryer", model: "gemini-3.8-flash", outcome: "ok" },
          }),
          expect.objectContaining({
            name: "recipe_version.draft.tokens",
            value: 3,
            attributes: { model: "gemini-3.8-flash", kind: "thinking" },
          }),
        ])
      )
      expect(JSON.stringify(samples)).not.toContain(RECIPE_ID)
    } finally {
      await posthog.uninstall()
    }
  })

  it("marks a failed draft's span as an error", async () => {
    const posthog = installTestPostHog()
    try {
      vi.mocked(generateRecipeVersionDraft).mockRejectedValue(
        new AiDraftError("The AI stopped before finishing the draft.", "MAX_TOKENS")
      )
      mealieReturns(200)
      await events(await post(valid))
      expect(posthog.span("recipe_version.draft")).toMatchObject({
        status: { code: "error" },
        attributes: { "http.response.status_code": 502, "error.detail": "MAX_TOKENS" },
      })
      expect(await posthog.flushMetrics()).toContainEqual(
        expect.objectContaining({
          name: "recipe_version.drafts",
          attributes: expect.objectContaining({ outcome: "error", status: "502" }),
        })
      )
    } finally {
      await posthog.uninstall()
    }
  })

  it("never echoes the API key or recipe text in logs", async () => {
    mealieReturns(200)
    const info = vi.mocked(console.info)
    await (await post(valid)).text()
    const logged = info.mock.calls.flat().join(" ")
    expect(logged).not.toContain("super-secret-gemini-key")
    expect(logged).not.toContain("olive oil")
    expect(logged).toContain("recipe_version_draft")
    const entry = JSON.parse(String(info.mock.calls.at(-1)?.[0]))
    expect(entry).toMatchObject({
      outcome: "ok",
      model: "gemini-3.8-flash",
      thinkingLevel: "medium",
      connectMs: 30,
      firstTokenMs: 40,
    })
  })

  it("requires a session", async () => {
    const response = await post(valid, {})
    expect(response.status).toBe(401)
    expect(generateRecipeVersionDraft).not.toHaveBeenCalled()
  })

  it.each([
    ["bad JSON", "{nope", 400],
    ["a missing target", { recipeId: RECIPE_ID }, 400],
    ["a non-UUID recipe", { ...valid, recipeId: "../../users" }, 400],
    ["long notes", { ...valid, notes: "x".repeat(501) }, 400],
    ["an oversized body", { ...valid, notes: "x".repeat(5000) }, 413],
  ])("rejects %s", async (_, body, status) => {
    const response = await post(body)
    expect(response.status).toBe(status)
    expect(generateRecipeVersionDraft).not.toHaveBeenCalled()
  })

  it.each([
    [404, 404],
    [401, 401],
  ])("maps Mealie %i to %i", async (mealie, status) => {
    mealieReturns(mealie, { detail: "x" })
    expect((await post(valid)).status).toBe(status)
  })

  it("refuses the recipe's own method", async () => {
    mealieReturns(200)
    expect((await post({ ...valid, target: "oven" })).status).toBe(400)
  })

  it("refuses a method that is already linked", async () => {
    mealieReturns(200, { ...recipe, extras: { airFryerVersion: "other-id" } })
    expect((await post(valid)).status).toBe(409)
  })

  it("refuses recipes too long to send", async () => {
    mealieReturns(200, {
      ...recipe,
      recipeInstructions: Array.from({ length: 50 }, () => ({ text: "x".repeat(1000) })),
    })
    expect((await post(valid)).status).toBe(413)
  })

  it("limits drafts per session per hour", async () => {
    process.env.RECIPE_VERSION_DRAFTS_PER_HOUR = "2"
    mealieReturns(200)
    expect((await post(valid)).status).toBe(200)
    expect((await post(valid)).status).toBe(200)
    const limited = await post(valid)
    expect(limited.status).toBe(429)
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0)
  })

  it("returns 504 when the request is aborted, whatever error the SDK throws", async () => {
    mealieReturns(200)
    const controller = new AbortController()
    vi.mocked(generateRecipeVersionDraft).mockImplementation(async () => {
      controller.abort()
      throw new Error("wrapped abort")
    })
    const response = await recipeVersionDraftHandler(
      new Request("http://app/api/manaaki/recipe-versions/draft", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: cookie() },
        body: JSON.stringify(valid),
        signal: controller.signal,
      })
    )
    expect((await events(response)).at(-1)).toMatchObject({ type: "error", status: 504 })
  })

  it("stops quietly when the cook leaves mid-draft", async () => {
    mealieReturns(200)
    let leave: () => void = () => {}
    const left = new Promise<void>(resolve => {
      leave = resolve
    })
    let abortedWhenLeft: boolean | undefined
    vi.mocked(generateRecipeVersionDraft).mockImplementation(
      async (_recipe, _target, _notes, signal, onProgress) => {
        onProgress?.({ stage: "thinking" })
        await left
        abortedWhenLeft = signal?.aborted
        onProgress?.({ stage: "writing", steps: 1 })
        throw new DOMException("aborted", "AbortError")
      }
    )
    const response = await post(valid)
    const reader = response.body!.getReader()
    expect(JSON.parse(new TextDecoder().decode((await reader.read()).value))).toEqual({
      type: "progress",
      stage: "thinking",
    })
    await reader.cancel()
    leave()
    await vi.waitFor(() =>
      expect(vi.mocked(console.info).mock.calls.flat().join(" ")).toContain('"status":504')
    )
    expect(abortedWhenLeft).toBe(true)
  })

  it("records a draft the cook left as abandoned, not as an error", async () => {
    const posthog = installTestPostHog()
    try {
      mealieReturns(200)
      let leave: () => void = () => {}
      const left = new Promise<void>(resolve => {
        leave = resolve
      })
      vi.mocked(generateRecipeVersionDraft).mockImplementation(
        async (_recipe, _target, _notes, _signal, onProgress) => {
          onProgress?.({ stage: "thinking" })
          await left
          throw new DOMException("aborted", "AbortError")
        }
      )
      const reader = (await post(valid)).body!.getReader()
      await reader.read()
      await reader.cancel()
      leave()
      await vi.waitFor(() => expect(posthog.span("recipe_version.draft")).toBeDefined())
      const span = posthog.span("recipe_version.draft")!
      expect(span.status).toBeUndefined()
      expect(span.events).toEqual([])
      expect(span.attributes).toMatchObject({ "recipe_version.abandoned": true })
      expect(await posthog.flushMetrics()).toContainEqual(
        expect.objectContaining({
          name: "recipe_version.drafts",
          attributes: expect.objectContaining({ outcome: "abandoned", status: "504" }),
        })
      )
    } finally {
      await posthog.uninstall()
    }
  })

  it("streams the model's progress before the result", async () => {
    mealieReturns(200)
    vi.mocked(generateRecipeVersionDraft).mockImplementation(
      async (_recipe, _target, _notes, _signal, onProgress) => {
        onProgress?.({ stage: "thinking" })
        onProgress?.({ stage: "writing", steps: 2 })
        return {
          draft: goodAirFryerDraft,
          usage: {
            inputTokens: 1,
            outputTokens: 2,
            thinkingTokens: 0,
            model: "m",
            thinkingLevel: "default",
            connectMs: 1,
            firstTokenMs: 1,
            modelMs: 2,
          },
        }
      }
    )
    const sent = await events(await post(valid))
    expect(sent.slice(0, 3)).toEqual([
      { type: "progress", stage: "thinking" },
      { type: "progress", stage: "writing", steps: 2 },
      { type: "progress", stage: "checking" },
    ])
  })

  it("frees the draft allowance an hour later", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    try {
      process.env.RECIPE_VERSION_DRAFTS_PER_HOUR = "1"
      mealieReturns(200)
      expect((await post(valid)).status).toBe(200)
      expect((await post(valid)).status).toBe(429)
      vi.setSystemTime(Date.now() + 3_600_001)
      expect((await post(valid)).status).toBe(200)
    } finally {
      vi.useRealTimers()
    }
  })

  it.each([
    [new AiNotConfiguredError(), 503, /isn't set up/],
    [new AiDraftError("The AI returned an empty draft."), 502, /empty draft/],
    [new ApiError({ message: "quota", status: 429 }), 429, /busy/],
    [new ApiError({ message: "boom", status: 500 }), 502, /AI service/],
    [new DOMException("timed out", "TimeoutError"), 504, /too long/],
  ])("maps %o to %i", async (failure, status, message) => {
    mealieReturns(200)
    vi.mocked(generateRecipeVersionDraft).mockRejectedValue(failure)
    const sent = await events(await post(valid))
    const body = sent.at(-1)
    expect(body).toMatchObject({ type: "error", status })
    expect(body.error).toMatch(message)
    expect(JSON.stringify(sent)).not.toContain("super-secret-gemini-key")
  })
})
