import { Dialog } from "@base-ui/react/dialog"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { useId, useState } from "react"

import type { ParsedIngredient, RecipeOutput } from "../api/generated/types.gen"
import {
  createIngredientMatch,
  loadIngredientCatalog,
  type IngredientCatalog,
} from "../api/ingredientCatalog"
import {
  ingredientNeedsReview,
  ingredientReviewKey,
  parseRecipeIngredients,
  saveReviewedIngredients,
  unparsedIngredients,
  type IngredientReview,
} from "../api/recipeParsing"
import { useCurrentUser } from "../hooks/useCurrentUser"
import { useOnline } from "../pwa/useOnline"

export function IngredientParsingAction({ recipe }: { recipe: RecipeOutput }) {
  const current = useCurrentUser()
  const userId = current?.user?.id ?? ""
  const recipeId = recipe.id || recipe.slug || ""
  const queryClient = useQueryClient()
  const queryKey = ingredientReviewKey(userId, recipeId)
  const { data: prepared } = useQuery<IngredientReview>({ queryKey, enabled: false })
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const online = useOnline()
  const count = unparsedIngredients(recipe).length
  if (!current || current.isAnonymous || !userId || !recipeId || !count) return null
  async function start() {
    setError("")
    if (prepared) {
      setOpen(true)
      return
    }
    setPending(true)
    try {
      const review = await parseRecipeIngredients(recipeId)
      queryClient.setQueryData(queryKey, review)
      setOpen(true)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not parse ingredients.")
    } finally {
      setPending(false)
    }
  }
  return (
    <div className="mb-5 rounded-xl border border-orange-900/50 bg-orange-950/20 p-4">
      <p className="mb-3 text-sm text-gray-300">
        {prepared
          ? "Parsed suggestions are ready to review."
          : "Separate ingredient amounts, foods, and units for better serving sizes and shopping lists."}
      </p>
      <button
        disabled={!online || pending}
        onClick={() => void start()}
        className="min-h-11 rounded-xl bg-orange-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending
          ? "Parsing ingredients…"
          : prepared
            ? "Review parsed ingredients"
            : "Parse ingredients with AI"}
      </button>
      {!online && (
        <p className="mt-2 text-sm text-gray-400">Reconnect to parse or save ingredients.</p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-300">
          {error}
        </p>
      )}
      {open && prepared && (
        <IngredientReviewDialog review={prepared} userId={userId} onClose={() => setOpen(false)} />
      )}
    </div>
  )
}

type ReviewRow = {
  parsed: ParsedIngredient
  keepOriginal: boolean
  reviewed: boolean
  needsReview: boolean
}

function IngredientReviewDialog({
  review,
  userId,
  onClose,
}: {
  review: IngredientReview
  userId: string
  onClose: () => void
}) {
  const [rows, setRows] = useState<ReviewRow[]>(() =>
    review.parsed.map(parsed => ({
      parsed: structuredClone(parsed),
      keepOriginal: false,
      reviewed: !ingredientNeedsReview(parsed),
      needsReview: ingredientNeedsReview(parsed),
    }))
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const online = useOnline()
  const queryClient = useQueryClient()
  const router = useRouter()
  const catalogQuery = useQuery({
    queryKey: ["ingredientCatalog", userId],
    queryFn: loadIngredientCatalog,
    enabled: online,
  })
  const unresolved = rows.some(
    row =>
      !row.keepOriginal &&
      (!row.reviewed ||
        (row.parsed.ingredient.food && !row.parsed.ingredient.food.id) ||
        (row.parsed.ingredient.unit && !row.parsed.ingredient.unit.id))
  )
  function change(index: number, row: ReviewRow) {
    setRows(previous => previous.map((value, position) => (position === index ? row : value)))
  }
  async function save() {
    if (pending || !online || unresolved) return
    setPending(true)
    setError("")
    try {
      await saveReviewedIngredients(
        review,
        rows.map(row => (row.keepOriginal ? null : row.parsed))
      )
      queryClient.removeQueries({
        queryKey: ingredientReviewKey(userId, review.recipe.id || review.recipe.slug || ""),
        exact: true,
      })
      await queryClient.invalidateQueries({ queryKey: ["recipes"] })
      await router.invalidate()
      onClose()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save ingredients.")
    } finally {
      setPending(false)
    }
  }
  return (
    <Dialog.Root
      open
      onOpenChange={value => {
        if (!value && !pending) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-[60] mobile-dialog max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-gray-800 bg-gray-900 p-5 text-gray-200">
          <Dialog.Title className="text-xl font-semibold">Review parsed ingredients</Dialog.Title>
          <Dialog.Description className="my-3 text-sm text-gray-400">
            Compare each suggestion with the original. Check uncertain matches before saving.
            Creating a food or unit adds it to Mealie immediately; ingredient changes wait until
            Save reviewed ingredients.
          </Dialog.Description>
          {catalogQuery.error && (
            <div role="alert" className="mb-4 text-sm text-red-300">
              Could not load foods and units.{" "}
              <button onClick={() => void catalogQuery.refetch()} className="min-h-11 underline">
                Retry matching data
              </button>
            </div>
          )}
          <form
            onSubmit={event => {
              event.preventDefault()
              void save()
            }}
          >
            <fieldset disabled={pending} className="space-y-4">
              {rows.map((row, index) => (
                <IngredientReviewRow
                  key={review.recipe.recipeIngredient?.[index]?.referenceId ?? index}
                  row={row}
                  index={index}
                  catalog={catalogQuery.data}
                  disabled={!online}
                  onChange={value => change(index, value)}
                  onCreated={() =>
                    void queryClient.invalidateQueries({ queryKey: ["ingredientCatalog", userId] })
                  }
                />
              ))}
            </fieldset>
            {unresolved && (
              <p role="status" className="my-3 text-sm text-orange-300">
                Review flagged ingredients and resolve unmatched foods or units, or keep their
                original text.
              </p>
            )}
            {error && (
              <p role="alert" className="my-3 text-sm text-red-300">
                {error}
              </p>
            )}
            <div className="sticky bottom-0 mt-4 flex flex-wrap justify-end gap-3 bg-gray-900 py-3">
              <Dialog.Close
                disabled={pending}
                className="min-h-11 rounded-xl border border-gray-700 px-4"
              >
                Cancel
              </Dialog.Close>
              <button
                disabled={!online || pending || unresolved}
                className="min-h-11 rounded-xl bg-orange-600 px-4 disabled:opacity-50"
              >
                {pending ? "Saving…" : "Save reviewed ingredients"}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function IngredientReviewRow({
  row,
  index,
  catalog,
  disabled,
  onChange,
  onCreated,
}: {
  row: ReviewRow
  index: number
  catalog?: IngredientCatalog
  disabled: boolean
  onChange: (row: ReviewRow) => void
  onCreated: () => void
}) {
  const id = useId()
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState("")
  const ingredient = row.parsed.ingredient
  const confidence = row.parsed.confidence?.average
  async function create(kind: "food" | "unit") {
    const name = ingredient[kind]?.name
    if (!name || !catalog || disabled) return
    setCreating(true)
    setError("")
    try {
      const match = await createIngredientMatch(kind, name)
      onChange({
        ...row,
        reviewed: false,
        needsReview: true,
        parsed: { ...row.parsed, ingredient: { ...ingredient, [kind]: match } },
      })
      onCreated()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not create match.")
    } finally {
      setCreating(false)
    }
  }
  return (
    <fieldset
      className="space-y-3 rounded-xl border border-gray-700 p-4"
      disabled={disabled || creating}
    >
      <legend className="px-1 text-sm font-semibold">Ingredient {index + 1}</legend>
      <p className="text-sm text-gray-300">Original: {row.parsed.input}</p>
      <p className="text-xs text-gray-400">
        {confidence == null
          ? "Confidence unavailable — please review"
          : `Parser confidence: ${Math.round(confidence * 100)}%${confidence < 0.85 ? " — please review" : ""}`}
      </p>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={row.keepOriginal}
          onChange={event => onChange({ ...row, keepOriginal: event.target.checked })}
        />
        Keep original text
      </label>
      {!row.keepOriginal && (
        <>
          <label className="block text-sm">
            Quantity
            <input
              type="number"
              min="0"
              step="any"
              required
              value={Number.isNaN(ingredient.quantity) ? "" : (ingredient.quantity ?? 0)}
              onChange={event =>
                onChange({
                  ...row,
                  reviewed: false,
                  needsReview: true,
                  parsed: {
                    ...row.parsed,
                    ingredient: { ...ingredient, quantity: event.target.valueAsNumber },
                  },
                })
              }
              className="mt-1 min-h-11 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 text-base"
            />
          </label>
          {(["unit", "food"] as const).map(kind => (
            <div key={kind}>
              <label className="block text-sm">
                {kind === "food" ? "Food" : "Unit"}
                <input
                  list={`${id}-${kind}`}
                  value={ingredient[kind]?.name ?? ""}
                  onChange={event => {
                    const name = event.target.value
                    const match = catalog?.[kind].find(
                      item => item.name.toLowerCase() === name.trim().toLowerCase()
                    )
                    onChange({
                      ...row,
                      reviewed: false,
                      needsReview: true,
                      parsed: {
                        ...row.parsed,
                        ingredient: {
                          ...ingredient,
                          [kind]: name.trim() ? (match ?? { name }) : null,
                        },
                      },
                    })
                  }}
                  className="mt-1 min-h-11 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 text-base"
                />
              </label>
              <datalist id={`${id}-${kind}`}>
                {catalog?.[kind].map(item => (
                  <option key={item.id} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </datalist>
              {ingredient[kind] && !ingredient[kind]?.id && (
                <div className="mt-1 text-sm text-orange-300">
                  Unmatched {kind}. Choose an existing match or{" "}
                  <button
                    type="button"
                    disabled={!catalog || creating}
                    onClick={() => void create(kind)}
                    className="min-h-11 underline"
                  >
                    Create {kind} “{ingredient[kind]?.name}”
                  </button>
                  .
                </div>
              )}
            </div>
          ))}
          <label className="block text-sm">
            Preparation / note
            <input
              value={ingredient.note ?? ""}
              onChange={event =>
                onChange({
                  ...row,
                  reviewed: false,
                  needsReview: true,
                  parsed: {
                    ...row.parsed,
                    ingredient: { ...ingredient, note: event.target.value },
                  },
                })
              }
              className="mt-1 min-h-11 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 text-base"
            />
          </label>
          {row.needsReview && (
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={row.reviewed}
                onChange={event => onChange({ ...row, reviewed: event.target.checked })}
              />
              I’ve checked this ingredient
            </label>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
    </fieldset>
  )
}
