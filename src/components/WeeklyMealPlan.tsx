import { mdiCartPlus, mdiChefHat, mdiChevronRight, mdiCalendarArrowRight } from "@mdi/js"
import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { createParser, useQueryState } from "nuqs"
import { useState } from "react"

import type { ReadPlanEntry } from "../api/generated/types.gen"
import { mealPlanQueryOptions, todayIsoDateString, toIsoDateString } from "../hooks/useMealPlan"
import { parsePlanDate } from "../utils/navigation"
import { encodeRecipeId, recipeImageUrl, recipeUrl } from "../utils/recipe"
import { BuildShoppingListDialog } from "./BuildShoppingListDialog"
import { Icon } from "./Icon"
import { MealPlanDialog, mealTypes } from "./MealPlanDialog"
import { entryTitle } from "./MealPlanEntryCard"
import { RecipeCardTimeBadge, RecipeCardToolBadges } from "./RecipeCardMeta"

const planDateParser = createParser({ parse: parsePlanDate, serialize: value => value })

const dateLabel = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", options)
const controlClass =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700"

export function WeeklyMealPlan() {
  const navigate = useNavigate()
  const [startDate, setStartDate] = useQueryState(
    "date",
    planDateParser.withDefault(todayIsoDateString()).withOptions({ history: "push" })
  )
  const [editing, setEditing] = useState<{ date: string; entry?: ReadPlanEntry } | null>(null)
  const [shopping, setShopping] = useState(false)
  const [recentOpen, setRecentOpen] = useState(false)
  const [chooseDate, setChooseDate] = useState(false)
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(`${startDate}T00:00:00`)
    date.setDate(date.getDate() + i)
    return toIsoDateString(date)
  })
  const plan = useQuery(mealPlanQueryOptions(startDate, days[6]))
  function shiftDays(amount: number) {
    const date = new Date(`${startDate}T00:00:00`)
    date.setDate(date.getDate() + amount)
    void setStartDate(toIsoDateString(date))
  }
  return (
    <main className="bg-gray-950 text-gray-100">
      <div className="mx-auto max-w-6xl px-6 py-4 md:px-10">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-1 text-xs font-semibold tracking-widest text-orange-400 uppercase">
              At your table
            </p>
            <h1 className="font-serif text-3xl leading-tight font-bold md:text-4xl">
              Meals coming up
            </h1>
          </div>
          <button
            type="button"
            aria-label="Build shopping list"
            title="Build shopping list"
            className={`${controlClass} gap-2 max-sm:px-3`}
            onClick={() => setShopping(true)}
          >
            <Icon path={mdiCartPlus} size={0.75} className="text-orange-400" aria-hidden={true} />
            <span>Build shopping list</span>
          </button>
        </div>
        <div
          className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2"
          role="group"
          aria-label="Choose dates"
        >
          <p className="text-sm text-gray-400" aria-live="polite">
            {dateLabel(startDate, { day: "numeric", month: "short" })} –{" "}
            {dateLabel(days[6], { day: "numeric", month: "short", year: "numeric" })}
          </p>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
            {startDate !== todayIsoDateString() && (
              <button
                type="button"
                className="min-h-11 hover:text-white"
                onClick={() => setStartDate(todayIsoDateString())}
              >
                Back to today
              </button>
            )}
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-1 hover:text-white"
              onClick={() => shiftDays(7)}
            >
              Next week <Icon path={mdiChevronRight} size={0.75} aria-hidden={true} />
            </button>
            <button
              type="button"
              className="min-h-11 hover:text-white"
              aria-expanded={chooseDate}
              onClick={() => setChooseDate(!chooseDate)}
            >
              Choose another date…
            </button>
          </div>
          {chooseDate && (
            <label className="flex w-full items-center gap-3 pb-2 text-sm text-gray-400">
              Start date
              <input
                type="date"
                required
                value={startDate}
                onChange={e => {
                  if (e.target.value) {
                    void setStartDate(e.target.value)
                    setChooseDate(false)
                  }
                }}
                className="min-h-11 rounded-lg border border-gray-800 bg-gray-900 p-2 text-base text-gray-200"
              />
            </label>
          )}
        </div>
        <div className="mb-1">
          <button
            type="button"
            aria-expanded={recentOpen}
            aria-controls="recent-meals"
            onClick={() => setRecentOpen(!recentOpen)}
            className="flex min-h-11 w-full items-center gap-2 text-left text-sm text-gray-400 hover:text-white"
          >
            Recent meals <span className="text-xs text-gray-500">· Previous 7 days</span>
            <Icon
              path={mdiChevronRight}
              size={0.75}
              className={recentOpen ? "rotate-90" : ""}
              aria-hidden={true}
            />
          </button>
          <div id="recent-meals">
            {recentOpen && (
              <RecentMeals onEdit={entry => setEditing({ date: entry.date, entry })} />
            )}
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
                  {entries.length === 0 && (
                    <button
                      type="button"
                      onClick={() => setEditing({ date })}
                      className="ml-auto min-h-11 text-sm text-gray-400 underline decoration-gray-700 underline-offset-4 hover:text-white md:absolute md:top-4 md:right-0 md:ml-0"
                      aria-label={`Add meal for ${dateLabel(date, { weekday: "long", day: "numeric", month: "long" })}`}
                    >
                      Add meal
                    </button>
                  )}
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
      <div className="min-w-0 self-start">
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
  const classes = `grid content-start items-start gap-x-4 ${src ? "grid-cols-[96px_minmax(0,1fr)_44px] sm:grid-cols-[128px_minmax(0,1fr)_44px]" : "grid-cols-[minmax(0,1fr)_44px]"}`
  return (
    <article className={`group/meal ${classes}`}>
      {entry.recipe?.id && entry.recipe.slug ? (
        <Link to={recipeUrl(entry.recipe.id, entry.recipe.slug)} className="group contents">
          {content}
        </Link>
      ) : (
        <div className="group contents">{content}</div>
      )}
      <div
        className={`mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 ${src ? "col-start-2" : ""}`}
      >
        {entry.recipe && (
          <>
            <RecipeCardTimeBadge recipe={entry.recipe} />
            <RecipeCardToolBadges recipe={entry.recipe} />
            {entry.recipe.id && entry.recipe.slug && (
              <Link
                to="/recipes/$id/$slug"
                params={{ id: encodeRecipeId(entry.recipe.id), slug: entry.recipe.slug }}
                search={{ cook: true }}
                aria-label={`Cook ${title}`}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-orange-400 hover:bg-gray-800 hover:text-orange-300 focus-visible:outline-2 focus-visible:outline-orange-400"
              >
                <Icon path={mdiChefHat} size={0.7} aria-hidden />
                Cook
              </Link>
            )}
          </>
        )}
      </div>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Adjust plan for ${title}`}
        title="Adjust plan: change date, meal type or note"
        className={`row-span-2 row-start-1 inline-flex size-11 items-center justify-center rounded-full text-gray-400 transition-[color,background-color,opacity] hover:bg-gray-800 hover:text-white focus-visible:bg-gray-800 focus-visible:outline-2 focus-visible:outline-orange-400 motion-reduce:transition-none [@media(hover:hover)_and_(pointer:fine)]:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-focus-within/meal:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:group-hover/meal:opacity-100 ${src ? "col-start-3" : "col-start-2"}`}
      >
        <Icon path={mdiCalendarArrowRight} size={0.75} aria-hidden={true} />
      </button>
    </article>
  )
}

function RecentMeals({ onEdit }: { onEdit: (entry: ReadPlanEntry) => void }) {
  const today = todayIsoDateString()
  const start = new Date(`${today}T00:00:00`)
  start.setDate(start.getDate() - 7)
  const end = new Date(`${today}T00:00:00`)
  end.setDate(end.getDate() - 1)
  const recent = useQuery(mealPlanQueryOptions(toIsoDateString(start), toIsoDateString(end)))
  if (recent.isPending)
    return (
      <p role="status" className="py-4 text-sm text-gray-400">
        Loading recent meals…
      </p>
    )
  if (recent.isError)
    return (
      <div role="alert" className="py-4 text-sm text-gray-400">
        Couldn't load recent meals.{" "}
        <button type="button" onClick={() => recent.refetch()} className="min-h-11 underline">
          Try again
        </button>
      </div>
    )
  const entries = recent.data
    .filter(entry => entry.date >= toIsoDateString(start) && entry.date <= toIsoDateString(end))
    .sort((a, b) => b.date.localeCompare(a.date))
  return (
    <div className="pb-5">
      <p className="mb-4 text-sm text-gray-400">
        Plans changed? Open a recipe to cook it, or adjust its planned day.
      </p>
      {entries.length ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {entries.map(entry => (
            <div key={entry.id}>
              <p className="mb-2 text-xs text-gray-400">
                {dateLabel(entry.date, { weekday: "short", day: "numeric", month: "short" })}
              </p>
              <MealStory entry={entry} onEdit={() => onEdit(entry)} />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">No meals planned in the previous seven days.</p>
      )}
    </div>
  )
}
