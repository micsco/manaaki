import { mdiCartPlus, mdiChevronLeft, mdiChevronRight } from "@mdi/js"
import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { useState } from "react"

import type { ReadPlanEntry } from "../api/generated/types.gen"
import { mealPlanQueryOptions, todayIsoDateString, toIsoDateString } from "../hooks/useMealPlan"
import { recipeImageUrl, recipeUrl } from "../utils/recipe"
import { BuildShoppingListDialog } from "./BuildShoppingListDialog"
import { Icon } from "./Icon"
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
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-2 md:px-10">
          <Link to="/recipes" className={`${controlClass} gap-1`}>
            <Icon path={mdiChevronLeft} size={0.75} aria-hidden={true} />
            All recipes
          </Link>
          <span
            aria-current="page"
            className="border-b-2 border-orange-400 py-3 text-sm font-medium text-gray-100"
          >
            Meal plan
          </span>
          <Link to="/shopping" className="ml-auto py-3 text-sm text-gray-300 hover:text-white">
            Shopping
          </Link>
        </div>
      </nav>
      <div className="mx-auto max-w-6xl px-6 py-5 md:px-10 md:py-6">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-1 text-xs font-semibold tracking-widest text-orange-400 uppercase">
              At your table
            </p>
            <h1 className="font-serif text-3xl leading-tight font-bold md:text-4xl">
              Meals for the week
            </h1>
          </div>
          <button
            type="button"
            className={`${controlClass} gap-2`}
            onClick={() => setShopping(true)}
          >
            <Icon path={mdiCartPlus} size={0.75} className="text-orange-400" aria-hidden={true} />
            Build shopping list
          </button>
        </div>
        <div
          className="mt-5 mb-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-2"
          role="group"
          aria-label="Choose dates"
        >
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                aria-label="Previous week"
                title="Previous week"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-gray-800 text-gray-300 transition-colors hover:bg-gray-700"
                onClick={() => shiftDays(-7)}
              >
                <Icon path={mdiChevronLeft} size={0.75} aria-hidden={true} />
              </button>
              <button
                type="button"
                aria-label="Next week"
                title="Next week"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-gray-800 text-gray-300 transition-colors hover:bg-gray-700"
                onClick={() => shiftDays(7)}
              >
                <Icon path={mdiChevronRight} size={0.75} aria-hidden={true} />
              </button>
            </div>
            <p className="text-sm font-medium text-gray-200" aria-live="polite">
              {dateLabel(startDate, { day: "numeric", month: "short" })} –{" "}
              {dateLabel(days[6], { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              className={controlClass}
              onClick={() => setStartDate(todayIsoDateString())}
            >
              Today
            </button>
            <label className="flex items-center gap-2 text-sm text-gray-400">
              Start date
              <input
                type="date"
                required
                value={startDate}
                onChange={e => {
                  if (e.target.value) setStartDate(e.target.value)
                }}
                className="min-h-11 min-w-0 rounded-lg border border-gray-800 bg-gray-900 px-2 text-base text-gray-300"
              />
            </label>
          </div>
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
                className="relative grid gap-3 border-t border-gray-800 py-4 md:grid-cols-[80px_minmax(0,1fr)] md:gap-5"
              >
                <div className="flex items-center gap-3 md:block">
                  <h2 className="text-sm font-semibold tracking-widest text-gray-400 uppercase">
                    {dateLabel(date, { weekday: "short" })}
                  </h2>
                  <p className="text-sm text-gray-300 md:mt-1">
                    {dateLabel(date, { day: "numeric", month: "short" })}
                  </p>
                  {date === todayIsoDateString() && (
                    <p className="text-xs text-orange-400 md:mt-1">Today</p>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditing({ date })}
                    className={`ml-auto min-h-11 text-sm text-gray-400 underline decoration-gray-700 underline-offset-4 hover:text-white md:ml-0 ${entries.length ? "" : "md:absolute md:top-4 md:right-0"}`}
                    aria-label={`Add meal for ${dateLabel(date, { weekday: "long", day: "numeric", month: "long" })}`}
                  >
                    Add meal
                  </button>
                </div>
                <div>
                  {entries.length ? (
                    <div className="grid gap-x-6 gap-y-4 lg:grid-cols-2">
                      {entries.map(entry => (
                        <MealStory
                          key={entry.id}
                          entry={entry}
                          onEdit={() => setEditing({ date, entry })}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="py-2 text-sm text-gray-500 md:py-3">Nothing planned yet.</p>
                  )}
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

function MealStory({ entry, onEdit }: { entry: ReadPlanEntry; onEdit: () => void }) {
  const title = entryTitle(entry)
  const src = recipeImageUrl(entry.recipe?.id, "min-original", entry.recipe?.image)
  const content = (
    <>
      {src && (
        <img
          src={src}
          alt=""
          loading="lazy"
          width={144}
          height={108}
          className="row-span-2 aspect-4/3 w-full rounded-lg object-cover transition-opacity group-hover:opacity-90"
        />
      )}
      <div className="min-w-0 self-end">
        <p className="mb-1 text-xs font-semibold tracking-widest text-gray-400 uppercase">
          {entry.entryType ?? "dinner"}
        </p>
        <h3 className="font-serif text-xl leading-snug font-bold text-gray-100 group-hover:text-orange-200 group-focus-visible:underline group-focus-visible:decoration-orange-400 group-focus-visible:underline-offset-4">
          {title}
        </h3>
        {entry.text && entry.text !== title && (
          <p className="mt-1 text-sm leading-relaxed text-gray-400">{entry.text}</p>
        )}
      </div>
    </>
  )
  const classes = `grid content-start items-start gap-x-4 ${src ? "grid-cols-[96px_minmax(0,1fr)] sm:grid-cols-[128px_minmax(0,1fr)]" : ""}`
  return (
    <article className={classes}>
      {entry.recipe?.id && entry.recipe.slug ? (
        <Link to={recipeUrl(entry.recipe.id, entry.recipe.slug)} className="group contents">
          {content}
        </Link>
      ) : (
        <div className="group contents">{content}</div>
      )}
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${title}`}
        className={`min-h-11 justify-self-start text-sm text-gray-400 underline decoration-gray-700 underline-offset-4 hover:text-white ${src ? "col-start-2" : ""}`}
      >
        Move / edit
      </button>
    </article>
  )
}
