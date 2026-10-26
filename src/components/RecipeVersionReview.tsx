import { useId, useState } from "react"

import type { RecipeOutput } from "../api/generated/types.gen"
import {
  type DraftCheck,
  type DraftSource,
  methodLabel,
  type RecipeVersionDraft,
} from "../utils/recipeVersionDraft"
import type { CookingMethod } from "../utils/recipeVersions"
import {
  cookingPlan,
  type StepPlan,
  stepTagParts,
  visibleTag,
} from "../utils/recipeVersionStepTags"

export type ReviewState = {
  draft: RecipeVersionDraft
  stepPlans: (StepPlan | null)[]
  acceptedChanges: Set<number>
  acceptedNew: Set<number>
  acknowledged: boolean
}

const field =
  "mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-base text-gray-100 focus:border-orange-500 focus:ring-2 focus:ring-orange-500 focus:outline-hidden"
const label = "block text-sm font-medium text-gray-300"
const heading = "text-sm font-semibold tracking-wide text-gray-400 uppercase"
const textButton = "min-h-11 px-2 text-sm text-orange-300 hover:text-orange-200"
const quietButton = "min-h-11 px-2 text-sm text-gray-400 hover:text-gray-200"
const panel = "space-y-6 rounded-2xl border border-gray-800 bg-gray-900/60 p-4 sm:p-6"

function focusWhenOpened(element: HTMLTextAreaElement | null) {
  element?.focus()
}

function minutesOf(seconds: number | null | undefined): number | null {
  return seconds ? Math.round(seconds / 60) : null
}

export function CheckList({ checks }: { checks: DraftCheck[] }) {
  if (checks.length === 0) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-green-300">
        <span aria-hidden="true">✓</span>
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
          className={`rounded-lg border-l-4 py-1.5 pl-3 text-sm ${
            check.level === "block"
              ? "border-red-500 bg-red-950/40 text-red-200"
              : "border-amber-500 bg-amber-950/30 text-amber-100"
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

export function ReviewSummary({
  checks,
  assumptions,
}: {
  checks: DraftCheck[]
  assumptions: string[]
}) {
  return (
    <section
      aria-label="Checks"
      className="space-y-3 rounded-2xl border border-gray-800 bg-gray-900/60 p-4"
    >
      <CheckList checks={checks} />
      {assumptions.length > 0 && (
        <div className="text-sm text-gray-300">
          <p className="font-semibold text-gray-200">The AI assumed:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {assumptions.map(assumption => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function IngredientList({ source, state }: { source: DraftSource; state: ReviewState | null }) {
  const changes = new Map(
    (state?.draft.ingredientChanges ?? [])
      .filter(change => state?.acceptedChanges.has(change.index))
      .map(change => [change.index, change])
  )
  return (
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
      {(state?.draft.newIngredients ?? [])
        .filter((_, index) => state?.acceptedNew.has(index))
        .map(item => (
          <li key={`new-${item.text}`} className="text-orange-200">
            + {item.text}
          </li>
        ))}
    </ul>
  )
}

function StepChips({ parts, alongside }: { parts: string[]; alongside: boolean }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {parts.map(part => (
        <span
          key={part}
          className="rounded-full border border-gray-700 bg-gray-800 px-2 py-0.5 text-xs text-gray-200"
        >
          {part}
        </span>
      ))}
      {alongside && (
        <span className="rounded-full border border-orange-900/60 bg-orange-950/40 px-2 py-0.5 text-xs text-orange-200">
          At the same time
        </span>
      )}
    </span>
  )
}

export function OriginalPanel({
  recipe,
  source,
  className = "",
}: {
  recipe: RecipeOutput
  source: DraftSource
  className?: string
}) {
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
        <IngredientList source={source} state={null} />
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
  const [editingDetails, setEditingDetails] = useState(false)
  const [editingStep, setEditingStep] = useState<number | null>(null)
  const [editingNote, setEditingNote] = useState<number | null>(null)
  const { draft } = state
  const update = (patch: Partial<RecipeVersionDraft>) =>
    onChange({ ...state, draft: { ...draft, ...patch } })
  const toggle = (key: "acceptedChanges" | "acceptedNew", index: number) => {
    const next = new Set(state[key])
    if (next.has(index)) next.delete(index)
    else next.add(index)
    onChange({ ...state, [key]: next })
  }
  const setSteps = (steps: string[], stepPlans: (StepPlan | null)[]) =>
    onChange({ ...state, draft: { ...draft, steps }, stepPlans })
  const addStep = () => {
    setSteps([...draft.steps, ""], [...state.stepPlans, null])
    setEditingStep(draft.steps.length)
  }
  const removeStep = (index: number) => {
    setSteps(
      draft.steps.filter((_, i) => i !== index),
      state.stepPlans.filter((_, i) => i !== index)
    )
    setEditingStep(null)
  }
  const plan = cookingPlan(draft.steps, state.stepPlans)
  const was = {
    prepMinutes: minutesOf(recipe.prepTimeSeconds),
    cookMinutes: minutesOf(recipe.performTimeSeconds),
    totalMinutes: minutesOf(recipe.totalTimeSeconds),
  }
  const times: ["prepMinutes" | "cookMinutes" | "totalMinutes", string][] = [
    ["prepMinutes", "Prep"],
    ["cookMinutes", "Cook"],
    ["totalMinutes", "Total"],
  ]
  const wasNote = (key: "prepMinutes" | "cookMinutes" | "totalMinutes") =>
    was[key] !== null && was[key] !== draft[key] ? (
      <span className="mt-1 block text-xs text-gray-500">was {was[key]}</span>
    ) : null

  return (
    <section aria-label="New version" className={`${panel} ${className}`}>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <p className={heading}>Draft · {methodLabel(target)}</p>
          <button
            type="button"
            className={`${textButton} -mt-3`}
            onClick={() => setEditingDetails(!editingDetails)}
          >
            {editingDetails ? "Done" : "Edit details"}
          </button>
        </div>
        {editingDetails ? (
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
                className={`${field} field-sizing-content`}
              />
            </label>
            <div className="grid grid-cols-3 gap-3">
              {times.map(([key, text]) => (
                <label key={key} className={label}>
                  {`${text} (min)`}
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={Number.isFinite(draft[key]) ? draft[key] : ""}
                    onChange={event => update({ [key]: event.target.valueAsNumber })}
                    className={field}
                  />
                  {wasNote(key)}
                </label>
              ))}
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
        ) : (
          <div className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-100">{draft.name}</h2>
            {draft.description && (
              <p className="text-sm leading-relaxed text-gray-300">{draft.description}</p>
            )}
            <dl className="grid grid-cols-3 gap-3 text-sm">
              {times.map(([key, text]) => (
                <div key={key}>
                  <dt className="text-gray-400">{text}</dt>
                  <dd className="text-gray-100">
                    {Number.isFinite(draft[key]) ? `${draft[key]} min` : "–"}
                    {wasNote(key)}
                  </dd>
                </div>
              ))}
            </dl>
            {draft.waitingNote && (
              <p className="text-sm text-gray-400">Includes {draft.waitingNote}</p>
            )}
          </div>
        )}
      </div>

      {plan.length > 0 && (
        <div className="space-y-2">
          <h3 className={heading}>Cooking plan</h3>
          <ol aria-label="Cooking plan" className="space-y-2">
            {plan.map(row => (
              <li key={row.step} className="flex items-start gap-3 text-sm">
                <span className="w-14 shrink-0 pt-0.5 text-gray-400">Step {row.step}</span>
                <StepChips parts={row.parts} alongside={row.alongsidePrevious} />
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="space-y-2">
        <h3 className={heading}>Ingredients</h3>
        <IngredientList source={source} state={state} />
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

      <div className="space-y-2">
        <h3 className={heading}>Method</h3>
        <ol className="space-y-4">
          {draft.steps.map((step, index) => {
            const tag = visibleTag(state.stepPlans[index], step)
            const parts = tag ? stepTagParts(tag) : []
            const editing = editingStep === index
            return (
              // eslint-disable-next-line react/no-array-index-key -- steps are edited in place and have no ids
              <li key={index} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-950/60 text-xs font-semibold text-orange-200"
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-2">
                  {editing ? (
                    <>
                      <label htmlFor={`${id}-step-${index}`} className="sr-only">
                        Step {index + 1}
                      </label>
                      <textarea
                        id={`${id}-step-${index}`}
                        rows={3}
                        ref={focusWhenOpened}
                        value={step}
                        onChange={event =>
                          update({
                            steps: draft.steps.map((s, i) =>
                              i === index ? event.target.value : s
                            ),
                          })
                        }
                        className={`${field} mt-0 field-sizing-content`}
                      />
                    </>
                  ) : (
                    <p className="text-sm leading-relaxed text-gray-200">
                      {step || <span className="text-gray-500">Empty step</span>}
                    </p>
                  )}
                  {(parts.length > 0 || tag?.alongsidePrevious) && (
                    <StepChips parts={parts} alongside={Boolean(tag?.alongsidePrevious)} />
                  )}
                  <div className="-ml-2 flex gap-1">
                    <button
                      type="button"
                      aria-label={
                        editing ? `Done editing step ${index + 1}` : `Edit step ${index + 1}`
                      }
                      onClick={() => setEditingStep(editing ? null : index)}
                      className={textButton}
                    >
                      {editing ? "Done" : "Edit"}
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove step ${index + 1}`}
                      onClick={() => removeStep(index)}
                      className={quietButton}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
        <button type="button" onClick={addStep} className={`${textButton} -ml-2`}>
          + Add step
        </button>
      </div>

      {draft.notes.length > 0 && (
        <div className="space-y-3">
          <h3 className={heading}>New notes</h3>
          {draft.notes.map((note, index) => {
            const editing = editingNote === index
            const title = note.title || `Note ${index + 1}`
            return (
              // eslint-disable-next-line react/no-array-index-key -- notes are edited in place and have no ids
              <div key={index} className="space-y-1">
                {editing ? (
                  <label className={label}>
                    {title}
                    <textarea
                      rows={2}
                      ref={focusWhenOpened}
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
                ) : (
                  <>
                    <p className="text-sm font-medium text-gray-200">{title}</p>
                    <p className="text-sm leading-relaxed text-gray-300">{note.text}</p>
                  </>
                )}
                <button
                  type="button"
                  aria-label={editing ? `Done editing ${title}` : `Edit ${title}`}
                  onClick={() => setEditingNote(editing ? null : index)}
                  className={`${textButton} -ml-2`}
                >
                  {editing ? "Done" : "Edit"}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
