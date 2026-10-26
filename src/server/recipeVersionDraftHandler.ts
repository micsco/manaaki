import { createHash } from "node:crypto"

import { ApiError } from "@google/genai"
import { z } from "zod"

import { getOneApiRecipesSlugGet, type RecipeOutput } from "../api/generated"
import { checkDraft, type DraftSource } from "../utils/recipeVersionDraft"
import { cookingMethod, VERSION_EXTRAS_KEYS } from "../utils/recipeVersions"
import { recipeVersionDraftsPerHour } from "./env"
import { createMealieClient } from "./mealieClient"
import { upstreamFailureResponse } from "./mealieUpstream"
import {
  AiDraftError,
  AiNotConfiguredError,
  type DraftRequestRecipe,
  generateRecipeVersionDraft,
} from "./recipeVersionAi"
import { readSessionToken } from "./session"

const MAX_BODY_BYTES = 4096
const MAX_RECIPE_CHARS = 40_000
const AI_TIMEOUT_MS = 85_000
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

function minutes(seconds: number | null | undefined): number | null {
  return seconds ? Math.round(seconds / 60) : null
}

function toDraftRecipe(recipe: RecipeOutput): DraftRequestRecipe {
  const waiting = recipe.extras?.waitingTime
  return {
    name: recipe.name ?? "Recipe",
    description: recipe.description ?? "",
    servings: recipe.recipeServings ?? null,
    method: cookingMethod(recipe),
    ingredients: (recipe.recipeIngredient ?? []).map(line =>
      [line.title ? `[${line.title}]` : "", line.display || line.note || line.originalText || ""]
        .filter(Boolean)
        .join(" ")
    ),
    steps: (recipe.recipeInstructions ?? []).map(step => step.text ?? "").filter(Boolean),
    notes: (recipe.notes ?? []).map(note => ({ title: note.title ?? "", text: note.text ?? "" })),
    prepMinutes: minutes(recipe.prepTimeSeconds),
    cookMinutes: minutes(recipe.performTimeSeconds),
    totalMinutes: minutes(recipe.totalTimeSeconds),
    waitingNote: typeof waiting === "string" && waiting.trim() ? waiting.trim() : null,
  }
}

function toSource(recipe: RecipeOutput, draftRecipe: DraftRequestRecipe): DraftSource {
  return {
    name: draftRecipe.name,
    method: draftRecipe.method,
    ingredients: (recipe.recipeIngredient ?? []).map((line, index) => ({
      text: draftRecipe.ingredients[index],
      quantity: line.quantity || null,
    })),
    steps: draftRecipe.steps,
  }
}

export async function recipeVersionDraftHandler(request: Request): Promise<Response> {
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

  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(AI_TIMEOUT_MS)])
  try {
    const { draft, usage } = await generateRecipeVersionDraft(draftRecipe, target, notes, signal)
    const source = toSource(recipe, draftRecipe)
    const checks = checkDraft(draft, source, target)
    console.info(
      JSON.stringify({
        event: "recipe_version_draft",
        recipeId,
        target,
        model: usage.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        blocking: checks.filter(c => c.level === "block").length,
        warnings: checks.filter(c => c.level === "warn").length,
      })
    )
    return Response.json(
      { draft, checks, source },
      { headers: { "Cache-Control": "private, no-store" } }
    )
  } catch (failure) {
    if (failure instanceof AiNotConfiguredError) {
      return error(503, "AI isn't set up yet. Add GEMINI_API_KEY to Manaaki's environment.")
    }
    if (failure instanceof AiDraftError) return error(502, `${failure.message} Try again.`)
    if (failure instanceof ApiError) {
      if (failure.status === 429)
        return error(429, "The AI service is busy. Try again in a minute.")
      return error(502, "The AI service returned an error. Try again.")
    }
    if (
      signal.aborted ||
      (failure instanceof DOMException &&
        (failure.name === "TimeoutError" || failure.name === "AbortError"))
    ) {
      return error(504, "The AI took too long. Try again.")
    }
    throw failure
  }
}
