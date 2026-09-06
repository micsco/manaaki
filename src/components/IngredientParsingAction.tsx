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
import { formatQuantity } from "../utils/recipe"

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
  const unmatched = rows.filter(
    row =>
      !row.keepOriginal &&
      ((row.parsed.ingredient.food && !row.parsed.ingredient.food.id) ||
        (row.parsed.ingredient.unit && !row.parsed.ingredient.unit.id))
  )
  const invalid = rows.some(
    row =>
      !row.keepOriginal &&
      row.parsed.ingredient.quantity != null &&
      (!Number.isFinite(row.parsed.ingredient.quantity) || row.parsed.ingredient.quantity < 0)
  )
  const unresolved = unmatched.length > 0 || invalid
  function change(index: number, row: ReviewRow) {
    setRows(previous =>
      previous.map((value, position) => {
        if (position === index) return row
        const ingredient = { ...value.parsed.ingredient }
        for (const kind of ["food", "unit"] as const) {
          const before = previous[index].parsed.ingredient[kind]
          const after = row.parsed.ingredient[kind]
          const other = ingredient[kind]
          if (
            !before?.id &&
            after?.id &&
            other &&
            !other.id &&
            other.name.trim().toLowerCase() === before?.name.trim().toLowerCase()
          ) {
            ingredient[kind] = after
          }
        }
        return { ...value, parsed: { ...value.parsed, ingredient } }
      })
    )
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
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-[60] mobile-dialog max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-2xl border border-gray-800 bg-gray-900 p-5 text-gray-200">
          <Dialog.Title className="text-xl font-semibold">Review parsed ingredients</Dialog.Title>
          <Dialog.Description className="my-3 text-sm text-gray-400">
            Scan the suggestions and edit anything that looks wrong. Save ingredients applies your
            changes together.
          </Dialog.Description>
          <p role="status" className="mb-3 text-sm text-gray-300">
            {rows.length} {rows.length === 1 ? "ingredient" : "ingredients"} ·{" "}
            {unmatched.length
              ? `${unmatched.length} ${unmatched.length === 1 ? "needs" : "need"} matching`
              : invalid
                ? "Check amounts"
                : "Ready to save"}
          </p>
          {unmatched.length > 0 && (
            <button
              type="button"
              disabled={pending || !online}
              className="mb-3 min-h-11 text-sm text-orange-300 underline"
              onClick={() =>
                setRows(previous =>
                  previous.map(row =>
                    unmatched.includes(row) ? { ...row, keepOriginal: true } : row
                  )
                )
              }
            >
              Keep originals for unmatched ingredients
            </button>
          )}
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
                {invalid
                  ? "Enter valid, non-negative amounts before saving."
                  : "Choose a food or unit for unmatched ingredients, or keep their original text."}
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
                {pending ? "Saving…" : "Save ingredients"}
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
  const hasMissingMatch = Boolean(
    (ingredient.food && !ingredient.food.id) || (ingredient.unit && !ingredient.unit.id)
  )
  const [expanded, setExpanded] = useState(hasMissingMatch)
  const suggestion =
    [
      ingredient.quantity ? formatQuantity(ingredient.quantity) : "",
      ingredient.unit?.name,
      ingredient.food?.name,
      ingredient.note,
    ]
      .filter(Boolean)
      .join(" ") || row.parsed.input

  async function create(kind: "food" | "unit") {
    const name = ingredient[kind]?.name
    if (!name || !catalog || disabled) return
    setCreating(true)
    setError("")
    try {
      const match = await createIngredientMatch(kind, name)
      onChange({
        ...row,
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
      <legend className="sr-only">Ingredient {index + 1}</legend>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1 break-words">
          <p className="text-sm text-gray-400">Original: {row.parsed.input}</p>
          <p className="text-base font-medium text-gray-100">
            {row.keepOriginal ? row.parsed.input : suggestion}
          </p>
          <p className="text-xs text-orange-300">
            {row.keepOriginal
              ? "Keeping original"
              : hasMissingMatch
                ? "Needs a food or unit match"
                : ingredientNeedsReview(row.parsed)
                  ? "Double-check this suggestion"
                  : "Matched"}
          </p>
        </div>
        <button
          type="button"
          aria-label={`Edit ingredient ${index + 1}`}
          aria-expanded={expanded}
          aria-controls={`${id}-fields`}
          onClick={() => setExpanded(value => !value)}
          className="min-h-11 shrink-0 px-2 text-sm text-orange-300 underline"
        >
          {expanded ? "Done" : "Edit"}
        </button>
      </div>
      <div id={`${id}-fields`} hidden={!expanded}>
        {expanded && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => onChange({ ...row, keepOriginal: !row.keepOriginal })}
              className="min-h-11 text-sm text-orange-300 underline"
            >
              {row.keepOriginal ? "Use parsed suggestion" : "Keep original text"}
            </button>
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
                        . New records are added to Mealie immediately.
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
                        parsed: {
                          ...row.parsed,
                          ingredient: { ...ingredient, note: event.target.value },
                        },
                      })
                    }
                    className="mt-1 min-h-11 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 text-base"
                  />
                </label>
              </>
            )}
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
    </fieldset>
  )
}
