import { useId } from "react"

import type { RecipeOutput } from "../api/generated/types.gen"
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
const heading = "text-sm font-semibold tracking-wide text-gray-400 uppercase"
const panel = "space-y-6 rounded-2xl border border-gray-800 bg-gray-900/60 p-4 sm:p-6"

function minutesOf(seconds: number | null | undefined): number | null {
  return seconds ? Math.round(seconds / 60) : null
}

export function CheckList({ checks }: { checks: DraftCheck[] }) {
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

export function OriginalPanel({
  recipe,
  source,
  state,
  className = "",
}: {
  recipe: RecipeOutput
  source: DraftSource
  state: ReviewState
  className?: string
}) {
  const changes = new Map(
    state.draft.ingredientChanges
      .filter(change => state.acceptedChanges.has(change.index))
      .map(change => [change.index, change])
  )
  const times: [string, number | null][] = [
    ["Prep", minutesOf(recipe.prepTimeSeconds)],
    ["Cook", minutesOf(recipe.performTimeSeconds)],
    ["Total", minutesOf(recipe.totalTimeSeconds)],
  ]
  return (
    <section aria-label="Original recipe" className={`${panel} ${className}`}>
      <div>
        <p className={heading}>Original · {methodLabel(source.method)}</p>
        <h2 className="mt-1 text-xl font-semibold text-gray-100">{source.name}</h2>
      </div>
      <dl className="grid grid-cols-3 gap-3 text-sm">
        {times.map(([name, value]) => (
          <div key={name}>
            <dt className="text-gray-400">{name}</dt>
            <dd className="text-gray-100">{value === null ? "–" : `${value} min`}</dd>
          </div>
        ))}
      </dl>
      <div className="space-y-2">
        <h3 className={heading}>Ingredients</h3>
        <ul className="space-y-1 text-sm text-gray-300">
          {source.ingredients.map((line, index) => {
            const change = changes.get(index)
            return (
              // eslint-disable-next-line react/no-array-index-key -- ingredient lines are addressed by position
              <li key={index} className={change?.remove ? "text-gray-500 line-through" : ""}>
                {line.text}
                {change && !change.remove && change.quantity !== null && (
                  <span className="ml-2 rounded bg-orange-950/60 px-1.5 text-xs text-orange-200">
                    → {change.quantity}
                  </span>
                )}
              </li>
            )
          })}
          {state.draft.newIngredients
            .filter((_, index) => state.acceptedNew.has(index))
            .map(item => (
              <li key={`new-${item.text}`} className="text-orange-200">
                + {item.text}
              </li>
            ))}
        </ul>
      </div>
      <div className="space-y-2">
        <h3 className={heading}>Method</h3>
        <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed text-gray-300">
          {source.steps.map((step, index) => (
            // eslint-disable-next-line react/no-array-index-key -- read-only list of original steps
            <li key={index}>{step}</li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export function DraftEditor({
  recipe,
  source,
  target,
  state,
  onChange,
  className = "",
}: {
  recipe: RecipeOutput
  source: DraftSource
  target: CookingMethod
  state: ReviewState
  onChange: (state: ReviewState) => void
  className?: string
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
  const was = {
    prepMinutes: minutesOf(recipe.prepTimeSeconds),
    cookMinutes: minutesOf(recipe.performTimeSeconds),
    totalMinutes: minutesOf(recipe.totalTimeSeconds),
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
      {was[key] !== null && was[key] !== draft[key] && (
        <span className="mt-1 block text-xs text-gray-500">was {was[key]}</span>
      )}
    </label>
  )

  return (
    <section aria-label="New version" className={`${panel} ${className}`}>
      <p className={heading}>Draft · {methodLabel(target)}</p>
      <div className="space-y-3">
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
            rows={3}
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
      </div>

      {(draft.ingredientChanges.length > 0 || draft.newIngredients.length > 0) && (
        <div className="space-y-2">
          <h3 className={heading}>Ingredient changes</h3>
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
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className={heading}>Method</h3>
          <button
            type="button"
            onClick={() => update({ steps: [...draft.steps, ""] })}
            className="min-h-11 px-2 text-sm text-orange-300 underline"
          >
            Add step
          </button>
        </div>
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
                rows={4}
                value={step}
                onChange={event =>
                  update({
                    steps: draft.steps.map((s, i) => (i === index ? event.target.value : s)),
                  })
                }
                className={`${field} field-sizing-content`}
              />
            </li>
          ))}
        </ol>
      </div>

      {draft.notes.length > 0 && (
        <div className="space-y-3">
          <h3 className={heading}>New notes</h3>
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
                className={`${field} field-sizing-content`}
              />
            </label>
          ))}
        </div>
      )}
    </section>
  )
}
