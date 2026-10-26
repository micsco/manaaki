import { useId } from "react"

import {
  type DraftCheck,
  type DraftSource,
  methodLabel,
  type RecipeVersionDraft,
} from "../utils/recipeVersionDraft"
import type { CookingMethod } from "../utils/recipeVersions"

export type ReviewState = {
  draft: RecipeVersionDraft
  acceptedChanges: Set<number>
  acceptedNew: Set<number>
  acknowledged: boolean
}

const field =
  "mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-base text-gray-100 focus:border-orange-500 focus:ring-2 focus:ring-orange-500 focus:outline-hidden"
const label = "block text-sm font-medium text-gray-300"

function CheckList({ checks }: { checks: DraftCheck[] }) {
  if (checks.length === 0) {
    return (
      <p
        role="status"
        className="rounded-xl border border-green-900/60 bg-green-950/40 p-3 text-sm text-green-200"
      >
        All automated checks passed.
      </p>
    )
  }
  const ordered = [...checks].sort((a, b) =>
    a.level === b.level ? 0 : a.level === "block" ? -1 : 1
  )
  return (
    <ul aria-label="Automated checks" className="space-y-2">
      {ordered.map(check => (
        <li
          key={`${check.id}:${check.message}`}
          className={`rounded-xl border p-3 text-sm ${
            check.level === "block"
              ? "border-red-900/60 bg-red-950/40 text-red-200"
              : "border-amber-900/60 bg-amber-950/30 text-amber-100"
          }`}
        >
          <span className="font-semibold">
            {check.level === "block" ? "Must fix: " : "Check: "}
          </span>
          {check.message}
        </li>
      ))}
    </ul>
  )
}

export function RecipeVersionReview({
  source,
  target,
  state,
  checks,
  onChange,
}: {
  source: DraftSource
  target: CookingMethod
  state: ReviewState
  checks: DraftCheck[]
  onChange: (state: ReviewState) => void
}) {
  const id = useId()
  const { draft } = state
  const update = (patch: Partial<RecipeVersionDraft>) =>
    onChange({ ...state, draft: { ...draft, ...patch } })
  const toggle = (key: "acceptedChanges" | "acceptedNew", index: number) => {
    const next = new Set(state[key])
    if (next.has(index)) next.delete(index)
    else next.add(index)
    onChange({ ...state, [key]: next })
  }
  const minutesInput = (key: "prepMinutes" | "cookMinutes" | "totalMinutes", text: string) => (
    <label className={label}>
      {text}
      <input
        type="number"
        min="0"
        inputMode="numeric"
        value={Number.isFinite(draft[key]) ? draft[key] : ""}
        onChange={event => update({ [key]: event.target.valueAsNumber })}
        className={field}
      />
    </label>
  )

  return (
    <div className="space-y-6">
      <section aria-labelledby={`${id}-checks`} className="space-y-2">
        <h3
          id={`${id}-checks`}
          className="text-sm font-semibold tracking-wide text-gray-400 uppercase"
        >
          Checks
        </h3>
        <CheckList checks={checks} />
        {draft.assumptions.length > 0 && (
          <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-3 text-sm text-gray-300">
            <p className="font-semibold text-gray-200">The AI assumed:</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {draft.assumptions.map(assumption => (
                <li key={assumption}>{assumption}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <label className={label}>
          Name
          <input
            value={draft.name}
            onChange={event => update({ name: event.target.value })}
            className={field}
          />
        </label>
        <label className={label}>
          Description
          <textarea
            rows={2}
            value={draft.description}
            onChange={event => update({ description: event.target.value })}
            className={field}
          />
        </label>
        <div className="grid grid-cols-3 gap-3">
          {minutesInput("prepMinutes", "Prep (min)")}
          {minutesInput("cookMinutes", "Cook (min)")}
          {minutesInput("totalMinutes", "Total (min)")}
        </div>
        <label className={label}>
          Waiting included in the total
          <input
            value={draft.waitingNote ?? ""}
            placeholder="e.g. marinate 2 h"
            onChange={event => update({ waitingNote: event.target.value || null })}
            className={field}
          />
        </label>
      </section>

      {(draft.ingredientChanges.length > 0 || draft.newIngredients.length > 0) && (
        <section aria-labelledby={`${id}-ingredients`} className="space-y-2">
          <h3
            id={`${id}-ingredients`}
            className="text-sm font-semibold tracking-wide text-gray-400 uppercase"
          >
            Ingredient changes
          </h3>
          <p className="text-sm text-gray-400">
            Untick any you don't want. Everything else is copied exactly.
          </p>
          <ul className="space-y-2">
            {draft.ingredientChanges.map(change => {
              const line = source.ingredients[change.index]
              const after = change.remove
                ? "remove"
                : change.quantity !== null
                  ? `amount ${line?.quantity ?? "?"} → ${change.quantity}`
                  : "keep amount"
              return (
                <li
                  key={`change-${change.index}`}
                  className="rounded-xl border border-gray-800 p-3"
                >
                  <label className="grid grid-cols-[auto_1fr] items-start gap-x-3 text-sm text-gray-200">
                    <input
                      type="checkbox"
                      checked={state.acceptedChanges.has(change.index)}
                      onChange={() => toggle("acceptedChanges", change.index)}
                      className="row-span-2 mt-1 h-4 w-4 accent-orange-500"
                    />
                    <span className="font-medium">
                      {line?.text ?? `Line ${change.index + 1}`} · {after}
                    </span>
                    <span className="text-gray-400">{change.reason}</span>
                  </label>
                </li>
              )
            })}
            {draft.newIngredients.map((item, index) => (
              // eslint-disable-next-line react/no-array-index-key -- acceptedNew is keyed by position
              <li key={index} className="rounded-xl border border-gray-800 p-3">
                <label className="grid grid-cols-[auto_1fr] items-start gap-x-3 text-sm text-gray-200">
                  <input
                    type="checkbox"
                    checked={state.acceptedNew.has(index)}
                    onChange={() => toggle("acceptedNew", index)}
                    className="row-span-2 mt-1 h-4 w-4 accent-orange-500"
                  />
                  <span className="font-medium">Add: {item.text}</span>
                  <span className="text-gray-400">{item.reason}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby={`${id}-method`} className="space-y-3">
        <div className="flex items-center justify-between">
          <h3
            id={`${id}-method`}
            className="text-sm font-semibold tracking-wide text-gray-400 uppercase"
          >
            {methodLabel(target)} method
          </h3>
          <button
            type="button"
            onClick={() => update({ steps: [...draft.steps, ""] })}
            className="min-h-11 px-2 text-sm text-orange-300 underline"
          >
            Add step
          </button>
        </div>
        <details className="rounded-xl border border-gray-800 p-3 text-sm text-gray-300">
          <summary className="min-h-11 cursor-pointer content-center font-medium text-gray-200">
            Original {methodLabel(source.method).toLowerCase()} method
          </summary>
          <ol className="mt-2 list-decimal space-y-2 pl-5">
            {source.steps.map((step, index) => (
              // eslint-disable-next-line react/no-array-index-key -- read-only list of original steps
              <li key={index}>{step}</li>
            ))}
          </ol>
        </details>
        <ol className="space-y-3">
          {draft.steps.map((step, index) => (
            // eslint-disable-next-line react/no-array-index-key -- steps are edited in place and have no ids
            <li key={index}>
              <div className="flex items-center justify-between">
                <label htmlFor={`${id}-step-${index}`} className={label}>
                  Step {index + 1}
                </label>
                <button
                  type="button"
                  aria-label={`Remove step ${index + 1}`}
                  onClick={() => update({ steps: draft.steps.filter((_, i) => i !== index) })}
                  className="min-h-11 px-2 text-sm text-gray-400 underline"
                >
                  Remove
                </button>
              </div>
              <textarea
                id={`${id}-step-${index}`}
                rows={3}
                value={step}
                onChange={event =>
                  update({
                    steps: draft.steps.map((s, i) => (i === index ? event.target.value : s)),
                  })
                }
                className={field}
              />
            </li>
          ))}
        </ol>
      </section>

      {draft.notes.length > 0 && (
        <section aria-labelledby={`${id}-notes`} className="space-y-3">
          <h3
            id={`${id}-notes`}
            className="text-sm font-semibold tracking-wide text-gray-400 uppercase"
          >
            Notes
          </h3>
          {draft.notes.map((note, index) => (
            // eslint-disable-next-line react/no-array-index-key -- notes are edited in place and have no ids
            <label key={index} className={label}>
              {note.title || `Note ${index + 1}`}
              <textarea
                rows={2}
                value={note.text}
                onChange={event =>
                  update({
                    notes: draft.notes.map((n, i) =>
                      i === index ? { ...n, text: event.target.value } : n
                    ),
                  })
                }
                className={field}
              />
            </label>
          ))}
        </section>
      )}

      {checks.some(check => check.level === "warn") && (
        <label className="flex items-start gap-3 rounded-xl border border-amber-900/60 bg-amber-950/30 p-3 text-sm text-amber-100">
          <input
            type="checkbox"
            checked={state.acknowledged}
            onChange={event => onChange({ ...state, acknowledged: event.target.checked })}
            className="mt-1 h-4 w-4 accent-orange-500"
          />
          I've checked the warnings above.
        </label>
      )}
    </div>
  )
}
