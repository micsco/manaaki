import { Dialog } from "@base-ui/react/dialog"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import {
  createOneApiHouseholdsMealplansPost,
  updateOneApiHouseholdsMealplansItemIdPut,
} from "../api/generated/sdk.gen"
import type { PlanEntryType, ReadPlanEntry } from "../api/generated/types.gen"
import { mealPlanQueryOptions, toIsoDateString } from "../hooks/useMealPlan"
import { recipeListQueryOptions } from "../hooks/useRecipeList"
import { toastManager } from "../lib/toastManager"
import { recipeImageUrl } from "../utils/recipe"
import { entryTitle } from "./MealPlanEntryCard"

export const mealTypes: PlanEntryType[] = [
  "breakfast",
  "lunch",
  "dinner",
  "side",
  "snack",
  "drink",
  "dessert",
]
const fieldClass =
  "w-full rounded-lg border border-gray-700 bg-gray-800 p-3 text-base text-gray-100"

export function MealPlanDialog({
  date: initialDate,
  recipe,
  entry,
  onClose,
}: {
  date: string
  recipe?: { id: string; name?: string | null }
  entry?: ReadPlanEntry
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [date, setDate] = useState(initialDate)
  const [quickDays] = useState(() =>
    Array.from({ length: 7 }, (_, offset) => {
      const day = new Date()
      day.setDate(day.getDate() + offset)
      return {
        date: toIsoDateString(day),
        label:
          offset === 0
            ? "Today"
            : offset === 1
              ? "Tomorrow"
              : day.toLocaleDateString("en-GB", { weekday: "short" }),
        detail: day.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
        fullLabel: day.toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
        }),
      }
    })
  )
  const [customDate, setCustomDate] = useState(!quickDays.some(day => day.date === initialDate))
  const [otherMeal, setOtherMeal] = useState(
    Boolean(entry?.entryType && !["lunch", "dinner"].includes(entry.entryType))
  )
  const [type, setType] = useState<PlanEntryType>(entry?.entryType ?? "dinner")
  const [selected, setSelected] = useState(recipe?.id ?? entry?.recipeId ?? entry?.recipe?.id ?? "")
  const [search, setSearch] = useState("")
  const [noteOnly, setNoteOnly] = useState(Boolean(entry && !entry.recipeId && !entry.recipe))
  const [title, setTitle] = useState(entry?.title ?? "")
  const [text, setText] = useState(entry?.text ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const plan = useQuery({ ...mealPlanQueryOptions(date, date), enabled: Boolean(date) })
  const recipes = useQuery({ ...recipeListQueryOptions, enabled: !recipe && !entry && !noteOnly })
  const existing = (plan.data ?? []).filter(item => item.id !== entry?.id)
  const choices = (recipes.data ?? []).filter(item =>
    item.name?.toLowerCase().includes(search.toLowerCase())
  )

  async function save() {
    if (!date || (!selected && !noteOnly) || (noteOnly && !title.trim())) return
    setSaving(true)
    setError(null)
    const body = { date, entryType: type, recipeId: noteOnly ? null : selected, title, text }
    try {
      const result = entry
        ? await updateOneApiHouseholdsMealplansItemIdPut({
            path: { item_id: entry.id },
            body: { ...body, id: entry.id, groupId: entry.groupId, userId: entry.userId },
          })
        : await createOneApiHouseholdsMealplansPost({ body })
      if (result.error || !result.data) throw new Error("Save failed")
      await qc.invalidateQueries({ queryKey: ["mealplan"] })
      toastManager.add({
        title: entry ? "Meal plan updated" : "Added to meal plan",
        description: `${new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} · ${type}`,
      })
      onClose()
    } catch {
      setError("Couldn't save this meal. Your choices are still here — please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog.Root
      open
      onOpenChange={open => {
        if (!open && !saving) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 mobile-dialog max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-gray-800 bg-gray-900 p-6 text-gray-100 shadow-xl">
          <Dialog.Title className="font-serif text-2xl font-bold">
            {entry ? "Edit planned meal" : "Add to meal plan"}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-gray-400">
            {recipe?.name ??
              (entry ? entryTitle(entry) : "Choose a recipe or leave a note for the day.")}
          </Dialog.Description>
          <form
            onSubmit={e => {
              e.preventDefault()
              void save()
            }}
            className="mt-5 space-y-4"
          >
            <fieldset className="space-y-3">
              <legend className="mb-2 text-sm font-semibold text-gray-300">Day</legend>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {quickDays.map(day => (
                  <button
                    key={day.date}
                    type="button"
                    aria-label={day.fullLabel}
                    aria-pressed={date === day.date}
                    onClick={() => {
                      setDate(day.date)
                      setCustomDate(false)
                    }}
                    className={`min-h-16 rounded-lg border px-1 py-2 text-center transition-colors ${date === day.date ? "border-orange-500 bg-orange-950 text-orange-200" : "border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500"}`}
                  >
                    <span className="block text-xs font-semibold">{day.label}</span>
                    <span className="mt-1 block text-xs">{day.detail}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                aria-expanded={customDate}
                onClick={() => setCustomDate(open => !open)}
                className="min-h-11 text-sm text-orange-400 underline underline-offset-4"
              >
                Another date
              </button>
              {customDate && (
                <label className="block space-y-2">
                  Choose date
                  <input
                    aria-label="Day"
                    type="date"
                    required
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className={fieldClass}
                  />
                </label>
              )}
            </fieldset>
            <fieldset className="space-y-3">
              <legend className="mb-2 text-sm font-semibold text-gray-300">Meal</legend>
              <div className="flex gap-2">
                {(["lunch", "dinner"] as const).map(meal => (
                  <button
                    key={meal}
                    type="button"
                    aria-pressed={type === meal}
                    onClick={() => {
                      setType(meal)
                      setOtherMeal(false)
                    }}
                    className={`min-h-11 flex-1 rounded-full border px-4 py-2 text-sm font-medium ${type === meal ? "border-orange-500 bg-orange-950 text-orange-200" : "border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500"}`}
                  >
                    {meal === "lunch" ? "Lunch" : "Dinner"}
                  </button>
                ))}
                <button
                  type="button"
                  aria-expanded={otherMeal}
                  onClick={() => setOtherMeal(open => !open)}
                  className={`min-h-11 rounded-full border px-4 py-2 text-sm ${!["lunch", "dinner"].includes(type) ? "border-orange-500 bg-orange-950 text-orange-200" : "border-gray-700 text-gray-300"}`}
                >
                  {!["lunch", "dinner"].includes(type)
                    ? type.charAt(0).toUpperCase() + type.slice(1)
                    : "Other"}
                </button>
              </div>
              {otherMeal && (
                <label className="block space-y-2">
                  Other meal type
                  <select
                    value={["lunch", "dinner"].includes(type) ? "" : type}
                    onChange={e => {
                      if (e.target.value) setType(e.target.value as PlanEntryType)
                    }}
                    className={fieldClass}
                  >
                    <option value="" disabled>
                      Choose a meal type
                    </option>
                    {mealTypes
                      .filter(meal => !["lunch", "dinner"].includes(meal))
                      .map(meal => (
                        <option key={meal} value={meal}>
                          {meal.charAt(0).toUpperCase() + meal.slice(1)}
                        </option>
                      ))}
                  </select>
                </label>
              )}
            </fieldset>
            {!recipe && !entry && (
              <label className="flex min-h-11 items-center gap-3">
                <input
                  type="checkbox"
                  checked={noteOnly}
                  onChange={e => setNoteOnly(e.target.checked)}
                />
                Note only, such as eating out or leftovers
              </label>
            )}
            {noteOnly ? (
              <label className="block space-y-2">
                Title
                <input
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className={fieldClass}
                />
              </label>
            ) : !recipe && !entry ? (
              <div>
                <label className="block space-y-2">
                  Find a recipe
                  <input
                    type="search"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className={fieldClass}
                  />
                </label>
                {recipes.isPending ? (
                  <p role="status">Loading recipes…</p>
                ) : recipes.isError ? (
                  <p role="alert">
                    Couldn't load recipes.{" "}
                    <button type="button" onClick={() => recipes.refetch()}>
                      Try again
                    </button>
                  </p>
                ) : (
                  <div className="mt-3 max-h-60 space-y-2 overflow-y-auto" aria-label="Recipes">
                    {choices.length === 0 && <p>No recipes match your search.</p>}
                    {choices.map(item => (
                      <label
                        key={item.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg p-2 ${selected === item.id ? "bg-orange-950" : "bg-gray-800"}`}
                      >
                        <input
                          type="radio"
                          name="recipe"
                          value={item.id ?? ""}
                          checked={selected === item.id}
                          onChange={() => setSelected(item.id ?? "")}
                        />
                        {recipeImageUrl(item.id, "min-original", item.image) && (
                          <img
                            src={recipeImageUrl(item.id, "min-original", item.image)!}
                            alt=""
                            className="size-14 rounded-sm object-cover"
                            loading="lazy"
                          />
                        )}
                        <span>{item.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
            <label className="block space-y-2">
              Planning note <span className="text-gray-400">(optional)</span>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Late finish, use the greens first…"
                rows={2}
                className={fieldClass}
              />
            </label>
            <section className="border-t border-gray-800 pt-3" aria-label="Already planned">
              <h3 className="text-sm font-semibold text-gray-300">Already planned for this day</h3>
              {plan.isPending ? (
                <p role="status" className="text-sm text-gray-400">
                  Loading plan…
                </p>
              ) : plan.isError ? (
                <p className="text-sm text-gray-400">
                  Couldn't check this day.{" "}
                  <button type="button" onClick={() => plan.refetch()} className="underline">
                    Try again
                  </button>
                </p>
              ) : existing.length ? (
                <ul className="mt-2 space-y-1 text-sm text-gray-400">
                  {existing.map(item => (
                    <li key={item.id}>
                      <span className="capitalize">{item.entryType}</span> · {entryTitle(item)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">No other meals planned.</p>
              )}
              <p className="mt-2 text-xs text-gray-400">
                Other meals on this day will stay in place.
              </p>
            </section>
            {error && (
              <p role="alert" className="text-sm text-red-400">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={onClose}
                className="min-h-11 rounded-full px-4 py-2 text-gray-300"
              >
                Cancel
              </button>
              <button
                disabled={saving || !date || (noteOnly ? !title.trim() : !selected)}
                className="min-h-11 rounded-full bg-orange-600 px-5 py-2 font-medium text-white hover:bg-orange-500 disabled:opacity-50"
              >
                {saving ? "Saving…" : entry ? "Save changes" : "Add meal"}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
