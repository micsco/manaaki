import { useQueryClient } from "@tanstack/react-query"
import { Link, useBlocker, useNavigate } from "@tanstack/react-router"
import { useEffect, useMemo, useRef, useState } from "react"

import type { RecipeOutput } from "../api/generated/types.gen"
import {
  linkOriginalToVersion,
  RecipeVersionLinkError,
  RecipeVersionUpdateError,
  requestRecipeVersionDraft,
  saveRecipeVersion,
  type DraftResponse,
  type SavedRecipeRef,
} from "../api/recipeVersions"
import { usePostHog } from "../contexts/AnalyticsContext"
import { useRecipeList } from "../hooks/useRecipeList"
import { useOnline } from "../pwa/useOnline"
import { householdAppliance } from "../utils/householdAppliances"
import { encodeRecipeId, recipeUrl } from "../utils/recipe"
import {
  blockingChecks,
  checkDraft,
  type DraftProgressEvent,
  type RecipeVersionDraft,
} from "../utils/recipeVersionDraft"
import {
  COOKING_METHOD_LABELS,
  cookingMethod,
  type CookingMethod,
  VERSION_EXTRAS_KEYS,
} from "../utils/recipeVersions"
import { RecipeVersionProgress } from "./RecipeVersionProgress"
import { CheckList, DraftEditor, OriginalPanel, type ReviewState } from "./RecipeVersionReview"

const METHODS: CookingMethod[] = ["oven", "airFryer", "slowCooker"]

type Step =
  | { kind: "choose" }
  | { kind: "drafting"; startedAt: number }
  | { kind: "review"; response: DraftResponse }
  | { kind: "saving"; response: DraftResponse }
  | { kind: "unlinked"; recipe: SavedRecipeRef }

const primary = "min-h-11 rounded-xl bg-orange-600 px-4 font-medium text-white disabled:opacity-50"
const secondary =
  "min-h-11 rounded-xl border border-gray-700 px-4 text-gray-200 disabled:opacity-50"

export function availableMethods(recipe: RecipeOutput) {
  const current = cookingMethod(recipe)
  return METHODS.map(method => ({
    method,
    disabled:
      method === current || typeof recipe.extras?.[VERSION_EXTRAS_KEYS[method]] === "string",
    reason:
      method === current
        ? "This recipe"
        : typeof recipe.extras?.[VERSION_EXTRAS_KEYS[method]] === "string"
          ? "Already linked"
          : null,
  }))
}

export function acceptedOnly(review: ReviewState): RecipeVersionDraft {
  return {
    ...review.draft,
    ingredientChanges: review.draft.ingredientChanges.filter(change =>
      review.acceptedChanges.has(change.index)
    ),
    newIngredients: review.draft.newIngredients.filter((_, index) => review.acceptedNew.has(index)),
  }
}

function initialReview(response: DraftResponse): ReviewState {
  return {
    draft: response.draft,
    acceptedChanges: new Set(response.draft.ingredientChanges.map(change => change.index)),
    acceptedNew: new Set(response.draft.newIngredients.map((_, index) => index)),
    acknowledged: false,
  }
}

type View = "both" | "original" | "draft"

const VIEWS: { view: View; label: string; className: string }[] = [
  { view: "both", label: "Side by side", className: "hidden lg:inline-flex" },
  { view: "original", label: "Original", className: "inline-flex" },
  { view: "draft", label: "Draft", className: "inline-flex" },
]

export function RecipeVersionPage({ recipe }: { recipe: RecipeOutput }) {
  const methods = useMemo(() => availableMethods(recipe), [recipe])
  const [target, setTarget] = useState<CookingMethod | null>(
    methods.find(option => !option.disabled)?.method ?? null
  )
  const [notes, setNotes] = useState("")
  const [step, setStep] = useState<Step>({ kind: "choose" })
  const [review, setReview] = useState<ReviewState | null>(null)
  const [error, setError] = useState("")
  const abort = useRef<AbortController | null>(null)
  const online = useOnline()
  const recipes = useRecipeList()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [pendingCopy, setPendingCopy] = useState<SavedRecipeRef | null>(null)
  const posthog = usePostHog()
  const [view, setView] = useState<View>("both")
  const [progress, setProgress] = useState<DraftProgressEvent | null>(null)
  const leaving = useRef(false)
  const appliance = target ? householdAppliance(target) : null
  const backTo = recipe.id && recipe.slug ? recipeUrl(recipe.id, recipe.slug) : "/recipes"

  useEffect(() => () => abort.current?.abort(), [])

  const existingNames = useMemo(() => recipes.map(r => r.name ?? "").filter(Boolean), [recipes])
  const response = step.kind === "review" || step.kind === "saving" ? step.response : null
  const checks = useMemo(
    () =>
      response && review && target
        ? checkDraft(acceptedOnly(review), response.source, target, existingNames)
        : [],
    [response, review, target, existingNames]
  )
  const hasDraft = review !== null && step.kind !== "unlinked"
  useBlocker({
    shouldBlockFn: () =>
      hasDraft && !leaving.current && !window.confirm("Leave without saving this draft?"),
    enableBeforeUnload: () => hasDraft && !leaving.current,
  })
  const blocked = blockingChecks(checks).length > 0
  const needsAck = checks.some(check => check.level === "warn") && !review?.acknowledged
  const busy = step.kind === "drafting" || step.kind === "saving"

  async function draft() {
    if (!recipe.id || !target || !online) return
    abort.current?.abort()
    const controller = new AbortController()
    abort.current = controller
    setError("")
    const startedAt = Date.now()
    setProgress(null)
    setStep({ kind: "drafting", startedAt })
    posthog.capture("recipe_version_draft_requested", { target })
    try {
      const result = await requestRecipeVersionDraft(
        recipe.id,
        target,
        notes,
        controller.signal,
        event =>
          setProgress(previous =>
            event.stage === "thinking" && !event.thought && previous?.stage === "thinking"
              ? previous
              : event
          )
      )
      if (controller.signal.aborted) return
      setReview(initialReview(result))
      setStep({ kind: "review", response: result })
      posthog.capture("recipe_version_draft_received", {
        target,
        blocking: blockingChecks(result.checks).length,
        warnings: result.checks.length - blockingChecks(result.checks).length,
        confidence: result.draft.confidence,
        steps: result.draft.steps.length,
        ingredient_changes: result.draft.ingredientChanges.length,
        client_ms: Date.now() - startedAt,
        model: result.metrics?.model,
        thinking_level: result.metrics?.thinkingLevel,
        first_chunk_ms: result.metrics?.firstChunkMs,
        input_tokens: result.metrics?.inputTokens,
        output_tokens: result.metrics?.outputTokens,
        thinking_tokens: result.metrics?.thinkingTokens,
        mealie_ms: result.metrics?.mealieMs,
        first_token_ms: result.metrics?.firstTokenMs,
        model_ms: result.metrics?.modelMs,
        server_ms: result.metrics?.totalMs,
      })
    } catch (failure) {
      if (controller.signal.aborted) {
        posthog.capture("recipe_version_draft_cancelled", {
          target,
          client_ms: Date.now() - startedAt,
        })
        return
      }
      const message = failure instanceof Error ? failure.message : "Couldn't create a draft."
      setError(message)
      setStep({ kind: "choose" })
      posthog.capture("recipe_version_draft_failed", {
        target,
        error: message,
        client_ms: Date.now() - startedAt,
      })
    }
  }

  async function finish(saved: SavedRecipeRef) {
    await queryClient.invalidateQueries({ queryKey: ["recipes"] })
    leaving.current = true
    await navigate({
      replace: true,
      to: "/recipes/$id/$slug",
      params: { id: encodeRecipeId(saved.id), slug: saved.slug },
    })
  }

  async function save() {
    if (!response || !review || !target || blocked || needsAck) return
    setError("")
    setStep({ kind: "saving", response })
    try {
      const saved = await saveRecipeVersion({
        original: recipe,
        draft: review.draft,
        target,
        acceptedChanges: review.acceptedChanges,
        acceptedNew: review.acceptedNew,
        existingCopy: pendingCopy ?? undefined,
      })
      posthog.capture("recipe_version_saved", {
        target,
        ingredientChanges: review.acceptedChanges.size,
        newIngredients: review.acceptedNew.size,
        warnings: checks.length,
      })
      await finish(saved)
    } catch (failure) {
      if (failure instanceof RecipeVersionUpdateError) setPendingCopy(failure.recipe)
      if (failure instanceof RecipeVersionLinkError) {
        setError(failure.message)
        setStep({ kind: "unlinked", recipe: failure.recipe })
        return
      }
      setError(failure instanceof Error ? failure.message : "Couldn't save the new version.")
      setStep({ kind: "review", response })
      posthog.capture("recipe_version_save_failed", { target })
    }
  }

  async function retryLink(saved: SavedRecipeRef) {
    if (!recipe.id || !target) return
    setError("")
    try {
      await linkOriginalToVersion(recipe.id, saved, target)
      await finish(saved)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Linking failed again.")
    }
  }

  function cancelDraft() {
    abort.current?.abort()
    setStep({ kind: "choose" })
  }

  return (
    <main className="min-h-dvh bg-gray-950 text-gray-100">
      <div className="mx-auto max-w-7xl space-y-6 px-4 pt-5 pb-32">
        <div className="space-y-2">
          <Link
            to={backTo}
            className="inline-flex min-h-11 items-center text-sm text-gray-400 hover:text-gray-200"
          >
            ← {recipe.name}
          </Link>
          <h1 className="font-serif text-3xl font-bold">New version with AI</h1>
          <p className="max-w-2xl text-sm text-gray-400">
            Gemini drafts a new method for “{recipe.name}”. Nothing is saved until you review the
            draft and choose Save.
          </p>
        </div>

        {(step.kind === "choose" || step.kind === "drafting") && (
          <form
            className="max-w-2xl space-y-4 rounded-2xl border border-gray-800 bg-gray-900/60 p-4 sm:p-6"
            onSubmit={event => {
              event.preventDefault()
              void draft()
            }}
          >
            <fieldset className="space-y-2" disabled={busy}>
              <legend className="text-sm font-medium text-gray-300">Cook it in</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {methods.map(option => (
                  <label
                    key={option.method}
                    className={`flex min-h-11 items-center gap-3 rounded-xl border border-gray-800 px-3 ${option.disabled ? "opacity-50" : ""}`}
                  >
                    <input
                      type="radio"
                      name="target"
                      value={option.method}
                      checked={target === option.method}
                      disabled={option.disabled}
                      onChange={() => setTarget(option.method)}
                      className="h-4 w-4 accent-orange-500"
                    />
                    <span>{COOKING_METHOD_LABELS[option.method]}</span>
                    {option.reason && (
                      <span className="ml-auto text-xs text-gray-500">{option.reason}</span>
                    )}
                  </label>
                ))}
              </div>
            </fieldset>
            {appliance && (
              <p className="text-sm text-gray-400">
                {`Written for your ${appliance.name} (${appliance.model}).`}
              </p>
            )}
            <label className="block text-sm font-medium text-gray-300">
              Anything the AI should know? (optional)
              <textarea
                rows={2}
                maxLength={500}
                value={notes}
                disabled={busy}
                placeholder="e.g. 5.5 L basket, cook in two batches"
                onChange={event => setNotes(event.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-base text-gray-100"
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <button className={primary} disabled={busy || !target || !online}>
                {step.kind === "drafting" ? "Drafting…" : "Create draft"}
              </button>
              {step.kind === "drafting" ? (
                <button type="button" className={secondary} onClick={cancelDraft}>
                  Stop
                </button>
              ) : (
                <Link to={backTo} className={`${secondary} inline-flex items-center`}>
                  Cancel
                </Link>
              )}
            </div>
            {step.kind === "drafting" && (
              <RecipeVersionProgress progress={progress} startedAt={step.startedAt} />
            )}
            {!target && (
              <p role="status" className="text-sm text-gray-400">
                This recipe already has every version.
              </p>
            )}
          </form>
        )}

        {response && review && target && (
          <>
            <section aria-label="Checks" className="grid gap-3 lg:grid-cols-2">
              <CheckList checks={checks} />
              {review.draft.assumptions.length > 0 && (
                <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-3 text-sm text-gray-300">
                  <p className="font-semibold text-gray-200">The AI assumed:</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {review.draft.assumptions.map(assumption => (
                      <li key={assumption}>{assumption}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <div
              role="group"
              aria-label="Compare"
              className="inline-flex gap-1 rounded-full border border-gray-800 p-1"
            >
              {VIEWS.map(option => (
                <button
                  key={option.view}
                  type="button"
                  aria-pressed={view === option.view}
                  data-default={option.view === "draft" && view === "both" ? "" : undefined}
                  onClick={() => setView(option.view)}
                  className={`${option.className} min-h-9 items-center rounded-full px-3.5 text-sm font-semibold ${
                    view === option.view
                      ? "bg-orange-600 text-white"
                      : "text-gray-300 hover:bg-gray-800 data-default:bg-orange-600 data-default:text-white lg:data-default:bg-transparent lg:data-default:text-gray-300"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div
              className={view === "both" ? "grid items-start gap-6 lg:grid-cols-2" : "grid gap-6"}
            >
              <OriginalPanel
                recipe={recipe}
                source={response.source}
                state={review}
                className={
                  view === "draft"
                    ? "hidden"
                    : view === "both"
                      ? "hidden lg:sticky lg:top-4 lg:block lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto"
                      : ""
                }
              />
              <DraftEditor
                recipe={recipe}
                source={response.source}
                target={target}
                state={review}
                onChange={setReview}
                className={view === "original" ? "hidden" : ""}
              />
            </div>
          </>
        )}

        {step.kind === "unlinked" && (
          <div className="flex flex-wrap gap-3">
            <button type="button" className={primary} onClick={() => void retryLink(step.recipe)}>
              Retry linking
            </button>
            <button type="button" className={secondary} onClick={() => void finish(step.recipe)}>
              Open the new version
            </button>
          </div>
        )}

        {!online && <p role="status">Reconnect to use AI.</p>}
        {error && (
          <p role="alert" className="text-red-300">
            {error}
          </p>
        )}
      </div>

      {response && review && target && (
        <div className="sticky bottom-0 border-t border-gray-800 bg-gray-950/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-xs">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
            {checks.some(check => check.level === "warn") && (
              <label className="flex min-h-11 items-center gap-2 text-sm text-amber-100">
                <input
                  type="checkbox"
                  checked={review.acknowledged}
                  onChange={event => setReview({ ...review, acknowledged: event.target.checked })}
                  className="h-4 w-4 accent-orange-500"
                />
                I've checked the warnings
              </label>
            )}
            {blocked && (
              <p role="status" className="text-sm text-red-300">
                Fix the “Must fix” items to save.
              </p>
            )}
            <div className="ml-auto flex flex-wrap gap-3">
              <Link to={backTo} className={`${secondary} inline-flex items-center`}>
                Cancel
              </Link>
              <button
                type="button"
                className={secondary}
                disabled={busy}
                onClick={() => setStep({ kind: "choose" })}
              >
                Start again
              </button>
              <button
                type="button"
                className={primary}
                disabled={busy || blocked || needsAck || !online}
                onClick={() => void save()}
              >
                {step.kind === "saving" ? "Saving…" : "Save new version"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
