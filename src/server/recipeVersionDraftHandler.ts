import { createHash } from "node:crypto"

import { z } from "zod"

import { getOneApiRecipesSlugGet, type RecipeOutput } from "../api/generated"
import { checkDraft, type DraftMetrics, type DraftStreamEvent } from "../utils/recipeVersionDraft"
import { VERSION_EXTRAS_KEYS } from "../utils/recipeVersions"
import { recipeVersionDraftsPerHour, recipeVersionModel } from "./env"
import { createMealieClient } from "./mealieClient"
import { upstreamFailureResponse } from "./mealieUpstream"
import { AiDraftError, AiNotConfiguredError, generateRecipeVersionDraft } from "./recipeVersionAi"
import { ModelBusyError, ModelCallError } from "./recipeVersionModels"
import { toDraftRecipe, toSource } from "./recipeVersionSource"
import { readSessionToken } from "./session"
import { metrics, traced } from "./telemetry"

const MAX_BODY_BYTES = 4096
const MAX_RECIPE_CHARS = 40_000
const AI_TIMEOUT_MS = 150_000
const HEARTBEAT_MS = 20_000
const HOUR_MS = 3_600_000

const requestSchema = z.object({
  recipeId: z.uuid(),
  target: z.enum(["oven", "airFryer", "slowCooker"]),
  notes: z.string().max(500).optional().default(""),
})

const draftsBySession = new Map<string, number[]>()

function error(status: number, message: string, headers: Record<string, string> = {}): Response {
  return Response.json(
    { error: message },
    { status, headers: { "Cache-Control": "private, no-store", ...headers } }
  )
}

function forgetExpiredSessions(now: number) {
  for (const [key, times] of draftsBySession) {
    if (now - times[times.length - 1] >= HOUR_MS) draftsBySession.delete(key)
  }
}

function takeDraftSlot(sessionKey: string, now = Date.now()): number | null {
  forgetExpiredSessions(now)
  const recent = (draftsBySession.get(sessionKey) ?? []).filter(time => now - time < HOUR_MS)
  if (recent.length >= recipeVersionDraftsPerHour()) {
    draftsBySession.set(sessionKey, recent)
    return Math.ceil((recent[0] + HOUR_MS - now) / 1000)
  }
  recent.push(now)
  draftsBySession.set(sessionKey, recent)
  return null
}

export function resetDraftRateLimit() {
  draftsBySession.clear()
}

function recordDraftOutcome(
  target: string,
  model: string,
  outcome: "ok" | "error" | "abandoned",
  status: number,
  durationMs: number
) {
  const attributes = { target, model, outcome }
  metrics.count("recipe_version.drafts", 1, {
    attributes: { ...attributes, status: String(status) },
  })
  metrics.histogram("recipe_version.draft.duration", durationMs, { unit: "ms", attributes })
}

function recordDraftTokens(usage: DraftMetrics) {
  const tokens = {
    input: usage.inputTokens,
    output: usage.outputTokens,
    thinking: usage.thinkingTokens,
  }
  for (const [kind, count] of Object.entries(tokens)) {
    if (count === null) continue
    metrics.histogram("recipe_version.draft.tokens", count, {
      attributes: { model: usage.model, kind },
    })
  }
}

function failureEvent(failure: unknown, signal: AbortSignal): { status: number; error: string } {
  if (failure instanceof AiNotConfiguredError) {
    return {
      status: 503,
      error:
        "AI isn't set up yet. Add the API key for the drafting model to Manaaki's environment.",
    }
  }
  if (failure instanceof ModelBusyError) {
    return { status: 429, error: "The AI service is busy. Try again in a minute." }
  }
  if (
    signal.aborted ||
    (failure instanceof DOMException &&
      (failure.name === "TimeoutError" || failure.name === "AbortError"))
  ) {
    return { status: 504, error: "The AI took too long. Try again." }
  }
  if (failure instanceof AiDraftError || failure instanceof ModelCallError) {
    return { status: 502, error: `${failure.message} Try again.` }
  }
  if (
    signal.aborted ||
    (failure instanceof DOMException &&
      (failure.name === "TimeoutError" || failure.name === "AbortError"))
  ) {
    return { status: 504, error: "The AI took too long. Try again." }
  }
  return { status: 500, error: "Something went wrong creating the draft. Try again." }
}

export async function recipeVersionDraftHandler(request: Request): Promise<Response> {
  const startedAt = performance.now()
  const elapsed = () => Math.round(performance.now() - startedAt)
  const token = readSessionToken(request)
  if (!token) return error(401, "Sign in to create recipe versions.")

  const declaredLength = Number(request.headers.get("content-length") ?? 0)
  if (declaredLength > MAX_BODY_BYTES) return error(413, "That request is too large.")
  const raw = await request.text()
  if (raw.length > MAX_BODY_BYTES) return error(413, "That request is too large.")
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return error(400, "The request wasn't valid JSON.")
  }
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) return error(400, "Choose a recipe and a cooking method.")
  const { recipeId, target, notes } = parsed.data

  let recipe: RecipeOutput
  try {
    const result = await getOneApiRecipesSlugGet({
      client: createMealieClient(token),
      path: { slug: recipeId },
      throwOnError: false,
    })
    const status = result.response?.status
    if (status === 401) return error(401, "Your session has expired. Sign in again.")
    if (status === 404 || (!result.data && status && status < 500))
      return error(404, "That recipe couldn't be found.")
    if (!result.data) return error(502, "Mealie didn't return the recipe. Try again.")
    recipe = result.data
  } catch (failure) {
    return upstreamFailureResponse(failure) ?? error(502, "Mealie couldn't be reached. Try again.")
  }

  const mealieMs = elapsed()
  const draftRecipe = toDraftRecipe(recipe)
  if (JSON.stringify(draftRecipe).length > MAX_RECIPE_CHARS) {
    return error(413, "This recipe is too long to convert with AI.")
  }
  if (draftRecipe.method === target) return error(400, "This recipe already uses that method.")
  if (typeof recipe.extras?.[VERSION_EXTRAS_KEYS[target]] === "string") {
    return error(409, "This recipe already has a version for that method.")
  }

  const sessionKey = createHash("sha256").update(token).digest("hex")
  const retryAfter = takeDraftSlot(sessionKey)
  if (retryAfter !== null) {
    return error(429, "You've made a lot of drafts this hour. Try again later.", {
      "Retry-After": String(retryAfter),
    })
  }

  const disconnected = new AbortController()
  const signal = AbortSignal.any([
    request.signal,
    disconnected.signal,
    AbortSignal.timeout(AI_TIMEOUT_MS),
  ])
  const encoder = new TextEncoder()
  let open = true
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const attributes = { "recipe_version.target": target, "recipe.id": recipeId }
      return traced("recipe_version.draft", { attributes }, async span => {
        let lastProgress: DraftStreamEvent | null = null
        const send = (event: DraftStreamEvent) => {
          if (!open) return
          if (event.type === "progress") lastProgress = event
          try {
            controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
          } catch {
            open = false
          }
        }
        const heartbeat = setInterval(() => {
          if (lastProgress) send(lastProgress)
        }, HEARTBEAT_MS)
        try {
          const source = toSource(recipe, draftRecipe)
          const { draft, usage } = await generateRecipeVersionDraft({
            recipe: draftRecipe,
            source,
            target,
            notes,
            signal,
            onProgress: progress => send({ type: "progress", ...progress }),
          })
          send({ type: "progress", stage: "checking" })
          const checksStartedAt = performance.now()
          const checks = checkDraft(draft, source, target)
          const draftMetrics: DraftMetrics = {
            model: usage.model,
            escalationModel: usage.escalationModel,
            calls: usage.calls,
            initialProblems: usage.initialProblems,
            repairRan: usage.repairRan,
            repairFixed: usage.repairFixed,
            escalated: usage.escalated,
            escalationFixed: usage.escalationFixed,
            thinkingLevel: usage.thinkingLevel,
            promptVersion: usage.promptVersion,
            firstChunkMs: usage.firstChunkMs,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            thinkingTokens: usage.thinkingTokens,
            mealieMs,
            firstTokenMs: usage.firstTokenMs,
            modelMs: usage.modelMs,
            checksMs: Math.round(performance.now() - checksStartedAt),
            totalMs: elapsed(),
          }
          console.info(
            JSON.stringify({
              event: "recipe_version_draft",
              outcome: "ok",
              recipeId,
              target,
              ...draftMetrics,
              blocking: checks.filter(c => c.level === "block").length,
              warnings: checks.filter(c => c.level === "warn").length,
              confidence: draft.confidence,
            })
          )
          span.setAttributes({
            "gen_ai.request.model": usage.model,
            "gen_ai.usage.input_tokens": usage.inputTokens,
            "gen_ai.usage.output_tokens": usage.outputTokens,
            "recipe_version.thinking_level": usage.thinkingLevel,
            "recipe_version.thinking_tokens": usage.thinkingTokens ?? undefined,
            "recipe_version.model_calls": usage.calls,
            "recipe_version.initial_problems": usage.initialProblems,
            "recipe_version.repaired": usage.repairRan,
            "recipe_version.escalated": usage.escalated,
            "recipe_version.confidence": draft.confidence,
            "recipe_version.blocking_checks": checks.filter(c => c.level === "block").length,
            "recipe_version.warning_checks": checks.filter(c => c.level === "warn").length,
          })
          recordDraftOutcome(target, usage.model, "ok", 200, draftMetrics.totalMs)
          recordDraftTokens(draftMetrics)
          send({ type: "result", draft, checks, source, metrics: draftMetrics })
        } catch (failure) {
          const event = failureEvent(failure, signal)
          if (event.status === 500) console.error(failure)
          const detail =
            failure instanceof AiDraftError || failure instanceof ModelCallError
              ? failure.detail
              : undefined
          const totalMs = elapsed()
          console.info(
            JSON.stringify({
              event: "recipe_version_draft",
              outcome: "error",
              recipeId,
              target,
              status: event.status,
              detail,
              mealieMs,
              totalMs,
            })
          )
          const abandoned = disconnected.signal.aborted || request.signal.aborted
          span.setAttributes({
            "http.response.status_code": event.status,
            "error.detail": detail,
            "recipe_version.abandoned": abandoned,
          })
          if (!abandoned) span.recordException(failure)
          recordDraftOutcome(
            target,
            recipeVersionModel(),
            abandoned ? "abandoned" : "error",
            event.status,
            totalMs
          )
          send({ type: "error", ...event })
        } finally {
          clearInterval(heartbeat)
          if (open) {
            open = false
            controller.close()
          }
        }
      })
    },
    cancel() {
      open = false
      disconnected.abort()
    },
  })
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Accel-Buffering": "no",
    },
  })
}
