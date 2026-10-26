import { Dialog } from "@base-ui/react/dialog"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
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
import { encodeRecipeId } from "../utils/recipe"
import { blockingChecks, checkDraft, type RecipeVersionDraft } from "../utils/recipeVersionDraft"
import {
  COOKING_METHOD_LABELS,
  cookingMethod,
  type CookingMethod,
  VERSION_EXTRAS_KEYS,
} from "../utils/recipeVersions"
import { RecipeVersionReview, type ReviewState } from "./RecipeVersionReview"

const METHODS: CookingMethod[] = ["oven", "airFryer", "slowCooker"]

type Step =
  | { kind: "choose" }
  | { kind: "drafting" }
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

export function RecipeVersionDialog({
  recipe,
  onClose,
}: {
  recipe: RecipeOutput
  onClose: () => void
}) {
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
  const blocked = blockingChecks(checks).length > 0
  const needsAck = checks.some(check => check.level === "warn") && !review?.acknowledged
  const busy = step.kind === "drafting" || step.kind === "saving"

  async function draft() {
    if (!recipe.id || !target || !online) return
    abort.current?.abort()
    const controller = new AbortController()
    abort.current = controller
    setError("")
    setStep({ kind: "drafting" })
    posthog.capture("recipe_version_draft_requested", { target })
    try {
      const result = await requestRecipeVersionDraft(recipe.id, target, notes, controller.signal)
      if (controller.signal.aborted) return
      setReview(initialReview(result))
      setStep({ kind: "review", response: result })
      posthog.capture("recipe_version_draft_received", {
        target,
        blocking: blockingChecks(result.checks).length,
        warnings: result.checks.length - blockingChecks(result.checks).length,
        confidence: result.draft.confidence,
      })
    } catch (failure) {
      if (controller.signal.aborted) return
      setError(failure instanceof Error ? failure.message : "Couldn't create a draft.")
      setStep({ kind: "choose" })
      posthog.capture("recipe_version_draft_failed", { target })
    }
  }

  async function finish(saved: SavedRecipeRef) {
    await queryClient.invalidateQueries({ queryKey: ["recipes"] })
    onClose()
    await navigate({
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
    <Dialog.Root
      open
      onOpenChange={value => {
        if (!value && step.kind !== "saving") onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 mobile-dialog max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 space-y-4 overflow-y-auto rounded-2xl border border-gray-800 bg-gray-900 p-6 text-gray-200">
          <Dialog.Title className="text-xl font-semibold">
            Create another version with AI
          </Dialog.Title>
          <Dialog.Description className="text-sm text-gray-400">
            {response
              ? "Review the draft. Nothing is saved until you choose Save."
              : `Gemini drafts a new method for “${recipe.name}”. You review every change before anything is saved.`}
          </Dialog.Description>

          {(step.kind === "choose" || step.kind === "drafting") && (
            <form
              className="space-y-4"
              onSubmit={event => {
                event.preventDefault()
                void draft()
              }}
            >
              <fieldset className="space-y-2" disabled={busy}>
                <legend className="text-sm font-medium text-gray-300">Cook it in</legend>
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
              </fieldset>
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
                  <Dialog.Close className={secondary}>Cancel</Dialog.Close>
                )}
              </div>
              {step.kind === "drafting" && (
                <p role="status" className="text-sm text-gray-400">
                  Drafting the new method. This usually takes 10–30 seconds.
                </p>
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
              <RecipeVersionReview
                source={response.source}
                target={target}
                state={review}
                checks={checks}
                onChange={setReview}
              />
              <div className="sticky bottom-0 -mx-6 -mb-6 flex flex-wrap gap-3 border-t border-gray-800 bg-gray-900 px-6 py-4">
                <button
                  type="button"
                  className={primary}
                  disabled={busy || blocked || needsAck || !online}
                  onClick={() => void save()}
                >
                  {step.kind === "saving" ? "Saving…" : "Save new version"}
                </button>
                <button
                  type="button"
                  className={secondary}
                  disabled={busy}
                  onClick={() => void draft()}
                >
                  Start again
                </button>
                <Dialog.Close className={secondary} disabled={busy}>
                  Cancel
                </Dialog.Close>
                {blocked && (
                  <p role="status" className="w-full text-sm text-red-300">
                    Fix the “Must fix” items to save.
                  </p>
                )}
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
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
