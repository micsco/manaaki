import { mdiChevronLeft, mdiChevronRight } from "@mdi/js"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useQueryState } from "nuqs"
import { Icon } from "../components/Icon"
import { MealPlanDayStrip } from "../components/MealPlanDayStrip"
import { MealPlanEntryCard } from "../components/MealPlanEntryCard"
import { isoWeekBounds, mealPlanQueryOptions, todayIsoDateString } from "../hooks/useMealPlan"

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

function weekLabel(startDate: string, endDate: string): string {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)

  if (start.getMonth() === end.getMonth()) {
    return `${MONTH_NAMES[start.getMonth()]} ${start.getFullYear()}`
  }

  const startMonth = MONTH_NAMES[start.getMonth()]
  const endMonth = MONTH_NAMES[end.getMonth()]
  if (start.getFullYear() === end.getFullYear()) {
    return `${startMonth} – ${endMonth} ${start.getFullYear()}`
  }
  return `${startMonth} ${start.getFullYear()} – ${endMonth} ${end.getFullYear()}`
}

function EmptyDay() {
  return <p className="py-8 text-center text-gray-500 text-sm">No meals planned</p>
}

function PlanPage() {
  const today = todayIsoDateString()

  const [weekOffset, setWeekOffset] = useQueryState("week", {
    parse: (v: string) => Number.parseInt(v, 10) || 0,
    serialize: (v: number) => String(v),
    defaultValue: 0,
    clearOnDefault: true,
  })

  const [selectedDay, setSelectedDay] = useQueryState("day", {
    defaultValue: today,
    clearOnDefault: true,
  })

  const { startDate, endDate } = isoWeekBounds(weekOffset)
  const { data: entries = [], isLoading } = useQuery(mealPlanQueryOptions(startDate, endDate))

  const label = weekLabel(startDate, endDate)

  function changeWeek(delta: number) {
    const next = weekOffset + delta
    setWeekOffset(next)
    const { startDate: nextStart } = isoWeekBounds(next)
    setSelectedDay(nextStart)
  }

  const dayEntries = entries.filter(e => e.date === selectedDay)

  const ENTRY_TYPE_ORDER = [
    "breakfast",
    "lunch",
    "dinner",
    "side",
    "snack",
    "drink",
    "dessert",
  ] as const
  const sortedDayEntries = [...dayEntries].sort((a, b) => {
    const ai = a.entryType ? ENTRY_TYPE_ORDER.indexOf(a.entryType) : ENTRY_TYPE_ORDER.length
    const bi = b.entryType ? ENTRY_TYPE_ORDER.indexOf(b.entryType) : ENTRY_TYPE_ORDER.length
    return ai - bi
  })

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <div className="mx-auto max-w-2xl px-4 py-6 md:max-w-5xl">
        <div className="mb-6 flex items-center gap-3">
          <Link
            to="/recipes"
            className="inline-flex items-center gap-1.5 rounded-full bg-gray-800 px-3 py-1.5 font-medium text-gray-300 text-sm transition-colors hover:bg-gray-700"
          >
            <Icon path={mdiChevronLeft} size={0.75} aria-hidden={true} />
            Recipes
          </Link>
          <h1 className="font-bold text-2xl text-gray-100">Meal Plan</h1>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => changeWeek(-1)}
            aria-label="Previous week"
            className="inline-flex items-center justify-center rounded-full bg-gray-800 p-2 text-gray-300 transition-colors hover:bg-gray-700"
          >
            <Icon path={mdiChevronLeft} size={0.75} aria-hidden={true} />
          </button>

          <span className="font-semibold text-gray-200 text-sm">{label}</span>

          <button
            type="button"
            onClick={() => changeWeek(1)}
            aria-label="Next week"
            className="inline-flex items-center justify-center rounded-full bg-gray-800 p-2 text-gray-300 transition-colors hover:bg-gray-700"
          >
            <Icon path={mdiChevronRight} size={0.75} aria-hidden={true} />
          </button>
        </div>

        <MealPlanDayStrip
          startDate={startDate}
          todayIso={today}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
        />

        <div className="mt-6 hidden md:block">
          <WeekGrid entries={entries} startDate={startDate} today={today} isLoading={isLoading} />
        </div>

        <div className="mt-6 md:hidden">
          {isLoading ? (
            <LoadingSkeleton />
          ) : sortedDayEntries.length > 0 ? (
            <div className="flex flex-col gap-3">
              {sortedDayEntries.map(entry => (
                <MealPlanEntryCard key={entry.id} entry={entry} />
              ))}
            </div>
          ) : (
            <EmptyDay />
          )}
        </div>
      </div>
    </main>
  )
}

function LoadingSkeleton() {
  return (
    <div role="status" aria-label="Loading meal plan" className="flex flex-col gap-3">
      {(["a", "b", "c"] as const).map(k => (
        <div
          key={k}
          className="h-[76px] animate-pulse rounded-lg border border-gray-800 bg-gray-900"
        />
      ))}
    </div>
  )
}

interface WeekGridProps {
  entries: import("../api/generated/types.gen").ReadPlanEntry[]
  startDate: string
  today: string
  isLoading: boolean
}

function WeekGrid({ entries, startDate, today, isLoading }: WeekGridProps) {
  const DAY_ABBREVS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
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

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${startDate}T00:00:00`)
    d.setDate(d.getDate() + i)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    const isoDate = `${y}-${m}-${day}`
    return {
      isoDate,
      label: `${DAY_ABBREVS[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`,
      isToday: isoDate === today,
    }
  })

  const ENTRY_TYPE_ORDER = [
    "breakfast",
    "lunch",
    "dinner",
    "side",
    "snack",
    "drink",
    "dessert",
  ] as const

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map(day => {
        const dayEntries = entries
          .filter(e => e.date === day.isoDate)
          .sort((a, b) => {
            const ai = a.entryType ? ENTRY_TYPE_ORDER.indexOf(a.entryType) : ENTRY_TYPE_ORDER.length
            const bi = b.entryType ? ENTRY_TYPE_ORDER.indexOf(b.entryType) : ENTRY_TYPE_ORDER.length
            return ai - bi
          })

        return (
          <div key={day.isoDate} className="flex flex-col gap-1.5">
            <div
              className={[
                "mb-1 rounded-lg px-2 py-1.5 text-center",
                day.isToday ? "bg-orange-600/20 ring-1 ring-orange-500" : "bg-gray-800/50",
              ].join(" ")}
            >
              <span
                className={[
                  "font-semibold text-xs",
                  day.isToday ? "text-orange-300" : "text-gray-400",
                ].join(" ")}
              >
                {day.label}
              </span>
            </div>

            {isLoading ? (
              <div className="h-16 animate-pulse rounded-lg bg-gray-900" />
            ) : dayEntries.length > 0 ? (
              dayEntries.map(entry => <MealPlanEntryCard key={entry.id} entry={entry} />)
            ) : (
              <p className="py-4 text-center text-gray-600 text-xs">—</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
