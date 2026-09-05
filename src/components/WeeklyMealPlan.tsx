import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { useState } from "react"

import type { ReadPlanEntry } from "../api/generated/types.gen"
import { mealPlanQueryOptions, todayIsoDateString, toIsoDateString } from "../hooks/useMealPlan"
import { recipeImageUrl, recipeUrl } from "../utils/recipe"
import { BuildShoppingListDialog } from "./BuildShoppingListDialog"
import { MealPlanDialog, mealTypes } from "./MealPlanDialog"
import { entryTitle } from "./MealPlanEntryCard"

const dateLabel = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", options)
const controlClass =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700"

export function WeeklyMealPlan() {
  const navigate = useNavigate()
  const [startDate, setStartDate] = useState(todayIsoDateString)
  const [editing, setEditing] = useState<{ date: string; entry?: ReadPlanEntry } | null>(null)
  const [shopping, setShopping] = useState(false)
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(`${startDate}T00:00:00`)
    date.setDate(date.getDate() + i)
    return toIsoDateString(date)
  })
  const plan = useQuery(mealPlanQueryOptions(startDate, days[6]))
  function shiftDays(amount: number) {
    const date = new Date(`${startDate}T00:00:00`)
    date.setDate(date.getDate() + amount)
    setStartDate(toIsoDateString(date))
  }
  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <nav aria-label="Meal planning" className="border-b border-gray-800">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-4 md:px-10">
          <Link to="/recipes" className={controlClass}>
            Recipes
          </Link>
          <span className="text-sm font-medium text-orange-400">Meal plan</span>
          <Link to="/shopping" className="ml-auto py-3 text-sm text-gray-300 hover:text-white">
            Shopping
          </Link>
        </div>
      </nav>
      <div className="mx-auto max-w-6xl px-6 py-8 md:px-10 md:py-12">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-3 text-xs font-semibold tracking-widest text-orange-400 uppercase">
              At your table
            </p>
            <h1 className="font-serif text-4xl leading-tight font-bold md:text-5xl">
              Meals for the week
            </h1>
            <p className="mt-3 text-gray-400">
              {dateLabel(startDate, { day: "numeric", month: "long" })} –{" "}
              {dateLabel(days[6], { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <button type="button" className={controlClass} onClick={() => setShopping(true)}>
            Build shopping list
          </button>
        </div>
        <div className="my-7 flex flex-wrap items-center gap-2" aria-label="Choose dates">
          <button type="button" className={controlClass} onClick={() => shiftDays(-7)}>
            Previous week
          </button>
          <button
            type="button"
            className={controlClass}
            onClick={() => setStartDate(todayIsoDateString())}
          >
            Today
          </button>
          <button type="button" className={controlClass} onClick={() => shiftDays(7)}>
            Next week
          </button>
          <label className="flex items-center gap-2 text-sm text-gray-400 sm:ml-auto">
            From
            <input
              type="date"
              required
              value={startDate}
              onChange={e => {
                if (e.target.value) setStartDate(e.target.value)
              }}
              className="min-h-11 rounded-lg border border-gray-700 bg-gray-900 p-2 text-base text-gray-200"
            />
          </label>
        </div>
        {plan.isPending ? (
          <div role="status" className="animate-pulse py-12 text-gray-400">
            Loading meals for the week…
          </div>
        ) : plan.isError ? (
          <div role="alert" className="py-12">
            <p>Couldn't load your meal plan.</p>
            <button type="button" onClick={() => plan.refetch()} className={`${controlClass} mt-4`}>
              Try again
            </button>
          </div>
        ) : (
          days.map(date => {
            const entries = plan.data
              .filter(entry => entry.date === date)
              .sort(
                (a, b) =>
                  mealTypes.indexOf(a.entryType ?? "dinner") -
                  mealTypes.indexOf(b.entryType ?? "dinner")
              )
            return (
              <section
                key={date}
                aria-label={dateLabel(date, { weekday: "long", day: "numeric", month: "long" })}
                className="grid gap-5 border-t border-gray-800 py-7 md:grid-cols-[100px_minmax(0,1fr)] md:gap-7 md:py-9"
              >
                <div>
                  <h2 className="text-sm font-semibold tracking-widest text-orange-400 uppercase">
                    {dateLabel(date, { weekday: "short" })}
                  </h2>
                  <p className="mt-1 text-sm text-gray-300">
                    {dateLabel(date, { day: "numeric", month: "short" })}
                  </p>
                  {date === todayIsoDateString() && (
                    <p className="mt-2 text-xs text-orange-400">Today</p>
                  )}
                </div>
                <div>
                  {entries.length ? (
                    <div
                      className={`grid gap-x-6 gap-y-8 ${entries.length > 1 ? "sm:grid-cols-2" : ""}`}
                    >
                      {entries.map(entry => (
                        <MealStory
                          key={entry.id}
                          entry={entry}
                          single={entries.length === 1}
                          onEdit={() => setEditing({ date, entry })}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="py-2 text-sm text-gray-500">Nothing planned yet.</p>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditing({ date })}
                    className="mt-4 min-h-11 text-sm text-orange-400 underline decoration-orange-400/30 underline-offset-4 hover:text-orange-300"
                    aria-label={`Add meal for ${dateLabel(date, { weekday: "long", day: "numeric", month: "long" })}`}
                  >
                    Add meal
                  </button>
                </div>
              </section>
            )
          })
        )}
      </div>
      {editing && (
        <MealPlanDialog
          date={editing.date}
          entry={editing.entry}
          onClose={() => setEditing(null)}
        />
      )}
      {shopping && (
        <BuildShoppingListDialog
          open
          onClose={() => setShopping(false)}
          onBuilt={({ listId, partial }) => {
            setShopping(false)
            void navigate({
              to: "/shopping",
              search: { list: listId, ...(partial ? { partial: true } : {}) },
            })
          }}
        />
      )}
    </main>
  )
}

function MealStory({
  entry,
  single,
  onEdit,
}: {
  entry: ReadPlanEntry
  single: boolean
  onEdit: () => void
}) {
  const title = entryTitle(entry)
  const src = recipeImageUrl(entry.recipe?.id, "min-original", entry.recipe?.image)
  const content = (
    <>
      {src && (
        <img
          src={src}
          alt=""
          loading="lazy"
          width={600}
          height={400}
          className="aspect-3/2 w-full rounded-sm object-cover transition-opacity group-hover:opacity-90"
        />
      )}
      <div className="min-w-0 self-center">
        <p className="mb-2 text-xs font-semibold tracking-widest text-orange-400 uppercase">
          {entry.entryType ?? "dinner"}
        </p>
        <h3 className="font-serif text-2xl leading-snug font-bold text-gray-100 group-hover:text-orange-200 md:text-3xl">
          {title}
        </h3>
        {entry.text && entry.text !== title && (
          <p className="mt-3 text-sm leading-relaxed text-gray-400">{entry.text}</p>
        )}
      </div>
    </>
  )
  const classes = `group grid gap-4 ${single && src ? "sm:grid-cols-2 sm:gap-7" : ""}`
  return (
    <article>
      {entry.recipe?.id && entry.recipe.slug ? (
        <Link to={recipeUrl(entry.recipe.id, entry.recipe.slug)} className={classes}>
          {content}
        </Link>
      ) : (
        <div className={classes}>{content}</div>
      )}
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${title}`}
        className="mt-3 min-h-11 text-sm text-gray-400 underline decoration-gray-700 underline-offset-4 hover:text-white"
      >
        Move / edit
      </button>
    </article>
  )
}
