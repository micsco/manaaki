import { mdiChevronLeft, mdiChevronRight } from "@mdi/js"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useQueryState } from "nuqs"
import type { ReadPlanEntry } from "../api/generated/types.gen"
import { Icon } from "../components/Icon"
import { MealPlanEntryCard } from "../components/MealPlanEntryCard"
import {
  isoWeekBounds,
  mealPlanQueryOptions,
  todayIsoDateString,
  toIsoDateString,
} from "../hooks/useMealPlan"

export const Route = createFileRoute("/plan")({
  head: () => ({
    meta: [{ title: "Meal Plan · Manaaki" }],
  }),
  loader: ({ context: { queryClient } }) => {
    const { startDate, endDate } = isoWeekBounds(0)
    return void queryClient.ensureQueryData(mealPlanQueryOptions(startDate, endDate))
  },
  component: PlanPage,
})

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

function weekLabel(startDate: string, endDate: string): string {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  if (start.getMonth() === end.getMonth()) {
    return `${MONTH_NAMES[start.getMonth()]} ${start.getFullYear()}`
  }
  const sm = MONTH_NAMES[start.getMonth()]
  const em = MONTH_NAMES[end.getMonth()]
  if (start.getFullYear() === end.getFullYear()) return `${sm} – ${em} ${start.getFullYear()}`
  return `${sm} ${start.getFullYear()} – ${em} ${end.getFullYear()}`
}

function dayHeadingLabel(isoDate: string, todayIso: string): string {
  const d = new Date(`${isoDate}T00:00:00`)
  const tomorrow = new Date(`${todayIso}T00:00:00`)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowIso = toIsoDateString(tomorrow)

  if (isoDate === todayIso)
    return `Today · ${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`
  if (isoDate === tomorrowIso)
    return `Tomorrow · ${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`
}

function dayEyebrowLabel(isoDate: string, todayIso: string): string {
  const d = new Date(`${isoDate}T00:00:00`)
  const tomorrow = new Date(`${todayIso}T00:00:00`)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowIso = toIsoDateString(tomorrow)
  if (isoDate === todayIso) return "Today"
  if (isoDate === tomorrowIso) return "Tomorrow"
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`
}

const ENTRY_TYPE_ORDER = [
  "breakfast",
  "lunch",
  "dinner",
  "side",
  "snack",
  "drink",
  "dessert",
] as const

function sortEntries(entries: ReadPlanEntry[]): ReadPlanEntry[] {
  return [...entries].sort((a, b) => {
    const ai = a.entryType ? ENTRY_TYPE_ORDER.indexOf(a.entryType) : ENTRY_TYPE_ORDER.length
    const bi = b.entryType ? ENTRY_TYPE_ORDER.indexOf(b.entryType) : ENTRY_TYPE_ORDER.length
    return ai - bi
  })
}

interface DaySection {
  isoDate: string
  entries: ReadPlanEntry[]
  isToday: boolean
}

function buildDaySections(
  entries: ReadPlanEntry[],
  startDate: string,
  todayIso: string
): DaySection[] {
  const sections: DaySection[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(`${startDate}T00:00:00`)
    d.setDate(d.getDate() + i)
    const isoDate = toIsoDateString(d)
    const dayEntries = sortEntries(entries.filter(e => e.date === isoDate))
    if (dayEntries.length > 0) {
      sections.push({ isoDate, entries: dayEntries, isToday: isoDate === todayIso })
    }
  }
  return sections
}

function PlanPage() {
  const today = todayIsoDateString()

  const [weekOffset, setWeekOffset] = useQueryState("week", {
    parse: (v: string) => Number.parseInt(v, 10) || 0,
    serialize: (v: number) => String(v),
    defaultValue: 0,
    clearOnDefault: true,
  })

  const { startDate, endDate } = isoWeekBounds(weekOffset)
  const { data: entries = [], isLoading } = useQuery(mealPlanQueryOptions(startDate, endDate))

  const label = weekLabel(startDate, endDate)
  const daySections = buildDaySections(entries, startDate, today)

  function changeWeek(delta: number) {
    setWeekOffset(weekOffset + delta)
  }

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <div className="sticky top-0 z-20 border-gray-800 border-b bg-gray-950/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              to="/recipes"
              className="inline-flex items-center gap-1 rounded-full bg-gray-800 px-3 py-1.5 font-medium text-gray-300 text-sm transition-colors hover:bg-gray-700"
            >
              <Icon path={mdiChevronLeft} size={0.7} aria-hidden={true} />
              Recipes
            </Link>
            <h1 className="font-bold text-gray-100 text-lg">Meal Plan</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => changeWeek(-1)}
              aria-label="Previous week"
              className="inline-flex items-center justify-center rounded-full bg-gray-800 p-2 text-gray-300 transition-colors hover:bg-gray-700"
            >
              <Icon path={mdiChevronLeft} size={0.7} aria-hidden={true} />
            </button>
            <span className="min-w-[9rem] text-center font-medium text-gray-300 text-sm">
              {label}
            </span>
            <button
              type="button"
              onClick={() => changeWeek(1)}
              aria-label="Next week"
              className="inline-flex items-center justify-center rounded-full bg-gray-800 p-2 text-gray-300 transition-colors hover:bg-gray-700"
            >
              <Icon path={mdiChevronRight} size={0.7} aria-hidden={true} />
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl">
        {isLoading ? (
          <LoadingSkeleton />
        ) : daySections.length === 0 ? (
          <EmptyWeek />
        ) : (
          <div className="divide-y divide-gray-800">
            {daySections.map(section => (
              <DayGroup key={section.isoDate} section={section} todayIso={today} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

function DayGroup({ section, todayIso }: { section: DaySection; todayIso: string }) {
  const heading = dayHeadingLabel(section.isoDate, todayIso)

  return (
    <section aria-label={heading}>
      <div className="px-4 pt-5 pb-2">
        <h2
          className={[
            "font-semibold text-sm uppercase tracking-wider",
            section.isToday ? "text-orange-400" : "text-gray-400",
          ].join(" ")}
        >
          {heading}
        </h2>
      </div>

      <div className="flex flex-col gap-px">
        {section.entries.map(entry => (
          <MealPlanEntryCard
            key={entry.id}
            entry={entry}
            dayLabel={dayEyebrowLabel(section.isoDate, todayIso)}
          />
        ))}
      </div>
    </section>
  )
}

function LoadingSkeleton() {
  return (
    <div role="status" aria-label="Loading meal plan" className="flex flex-col gap-px pt-4">
      {(["a", "b"] as const).map(k => (
        <div key={k} className="aspect-[16/7] w-full animate-pulse bg-gray-900 sm:aspect-[16/6]" />
      ))}
    </div>
  )
}

function EmptyWeek() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-gray-500 text-sm">No meals planned this week</p>
    </div>
  )
}
