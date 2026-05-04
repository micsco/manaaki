import { mdiChevronLeft } from "@mdi/js"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useCallback, useEffect, useRef, useState } from "react"
import type { ReadPlanEntry } from "../api/generated/types.gen"
import { Icon } from "../components/Icon"
import { MealPlanEntryCard } from "../components/MealPlanEntryCard"
import {
  isoWeekBounds,
  mealPlanQueryOptions,
  multiWeekBounds,
  todayIsoDateString,
  toIsoDateString,
} from "../hooks/useMealPlan"

export const Route = createFileRoute("/plan")({
  head: () => ({
    meta: [{ title: "Meal Plan · Manaaki" }],
  }),
  loader: ({ context: { queryClient } }) => {
    const { startDate, endDate } = multiWeekBounds(-1, 2)
    return void queryClient.ensureQueryData(mealPlanQueryOptions(startDate, endDate))
  },
  component: PlanPage,
})

const DAY_ABBREVS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
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

function weekMonday(weekOffset: number): Date {
  return new Date(`${isoWeekBounds(weekOffset).startDate}T00:00:00`)
}

function weekRowLabel(weekOffset: number): string {
  const { startDate, endDate } = isoWeekBounds(weekOffset)
  const s = new Date(`${startDate}T00:00:00`)
  const e = new Date(`${endDate}T00:00:00`)
  if (s.getMonth() === e.getMonth()) return `${MONTH_NAMES[s.getMonth()]} ${s.getFullYear()}`
  if (s.getFullYear() === e.getFullYear())
    return `${MONTH_SHORT[s.getMonth()]} – ${MONTH_SHORT[e.getMonth()]} ${s.getFullYear()}`
  return `${MONTH_SHORT[s.getMonth()]} ${s.getFullYear()} – ${MONTH_SHORT[e.getMonth()]} ${e.getFullYear()}`
}

function dayEyebrow(isoDate: string, todayIso: string): string {
  const tomorrow = new Date(`${todayIso}T00:00:00`)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowIso = toIsoDateString(tomorrow)
  if (isoDate === todayIso) return "Today"
  if (isoDate === tomorrowIso) return "Tomorrow"
  const d = new Date(`${isoDate}T00:00:00`)
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`
}

const CELL_MIN_W = "min-w-[140px]"
const CELL_MAX_W = "max-w-[220px]"

function WeekRow({
  weekOffset,
  entries,
  todayIso,
  todayRef,
}: {
  weekOffset: number
  entries: ReadPlanEntry[]
  todayIso: string
  todayRef?: React.RefObject<HTMLDivElement | null>
}) {
  const monday = weekMonday(weekOffset)
  const cells = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const isoDate = toIsoDateString(d)
    const isToday = isoDate === todayIso
    const dayEntries = sortEntries(entries.filter(e => e.date === isoDate))
    return { isoDate, d, isToday, dayEntries }
  })

  const _rowLabel = weekRowLabel(weekOffset)

  return (
    <div className="flex border-gray-800 border-b">
      {cells.map(({ isoDate, d, isToday, dayEntries }) => (
        <div
          key={isoDate}
          ref={isToday ? todayRef : undefined}
          className={[
            "flex flex-1 flex-col border-gray-800 border-r last:border-r-0",
            CELL_MIN_W,
            CELL_MAX_W,
            isToday ? "bg-orange-950/20" : "",
          ].join(" ")}
        >
          <div
            className={[
              "border-b px-2 py-1.5 text-center",
              isToday ? "border-orange-800/40 bg-orange-950/30" : "border-gray-800 bg-gray-900/50",
            ].join(" ")}
          >
            <span
              className={[
                "font-semibold text-xs",
                isToday ? "text-orange-400" : "text-gray-500",
              ].join(" ")}
            >
              {d.getDate()} {MONTH_SHORT[d.getMonth()]}
            </span>
          </div>

          <div className="flex flex-1 flex-col gap-px">
            {dayEntries.length > 0 ? (
              dayEntries.map(entry => (
                <MealPlanEntryCard
                  key={entry.id}
                  entry={entry}
                  dayLabel={dayEyebrow(isoDate, todayIso)}
                  compact
                />
              ))
            ) : (
              <div className="flex flex-1 items-center justify-center py-8">
                <span className="text-gray-700 text-xs">—</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function PlanPage() {
  const today = todayIsoDateString()

  const [startOffset, setStartOffset] = useState(-1)
  const [endOffset, setEndOffset] = useState(2)

  const { startDate, endDate } = multiWeekBounds(startOffset, endOffset)
  const {
    data: entries = [],
    isLoading,
    isFetching,
  } = useQuery({
    ...mealPlanQueryOptions(startDate, endDate),
    placeholderData: keepPreviousData,
  })

  const todayRef = useRef<HTMLDivElement | null>(null)
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const hasScrolledToToday = useRef(false)

  useEffect(() => {
    if (!isLoading && !hasScrolledToToday.current && todayRef.current) {
      todayRef.current.scrollIntoView({ block: "center", behavior: "smooth" })
      hasScrolledToToday.current = true
    }
  }, [isLoading])

  const loadMore = useCallback(() => {
    setEndOffset(prev => prev + 2)
  }, [])

  useEffect(() => {
    const sentinel = bottomSentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) loadMore()
      },
      { threshold: 0.1 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore])

  const weekOffsets = Array.from({ length: endOffset - startOffset + 1 }, (_, i) => startOffset + i)

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <div className="sticky top-0 z-30 border-gray-800 border-b bg-gray-950/95 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-3">
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
          <button
            type="button"
            onClick={() => {
              todayRef.current?.scrollIntoView({ block: "center", behavior: "smooth" })
            }}
            className="rounded-full bg-orange-600 px-3 py-1.5 font-medium text-sm text-white transition-colors hover:bg-orange-500"
          >
            Today
          </button>
        </div>
      </div>

      <div className="overflow-x-auto" ref={gridRef}>
        <div style={{ minWidth: `${7 * 140}px` }}>
          <div className="sticky top-[57px] z-20 flex border-gray-800 border-b bg-gray-950/95 backdrop-blur-sm">
            {DAY_ABBREVS.map(day => (
              <div
                key={day}
                className={[
                  "flex flex-1 items-center justify-center py-2 font-semibold text-gray-400 text-xs uppercase tracking-wider",
                  CELL_MIN_W,
                  CELL_MAX_W,
                ].join(" ")}
              >
                {day}
              </div>
            ))}
          </div>

          {isLoading ? (
            <LoadingSkeleton />
          ) : (
            <>
              <div className="flex justify-center border-gray-800 border-b py-3">
                <button
                  type="button"
                  onClick={() => setStartOffset(prev => prev - 2)}
                  disabled={isFetching}
                  className="rounded-full bg-gray-800 px-4 py-1.5 font-medium text-gray-300 text-xs transition-colors hover:bg-gray-700 disabled:opacity-50"
                >
                  Load earlier weeks
                </button>
              </div>

              {weekOffsets.map(offset => (
                <WeekRow
                  key={offset}
                  weekOffset={offset}
                  entries={entries}
                  todayIso={today}
                  todayRef={offset === 0 ? todayRef : undefined}
                />
              ))}

              <div ref={bottomSentinelRef} className="flex justify-center py-4">
                {isFetching && <span className="text-gray-500 text-xs">Loading…</span>}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  )
}

function LoadingSkeleton() {
  return (
    <div role="status" aria-label="Loading meal plan">
      {(["a", "b", "c", "d"] as const).map(k => (
        <div key={k} className="flex border-gray-800 border-b">
          {DAY_ABBREVS.map(day => (
            <div
              key={day}
              className={[
                "flex-1 border-gray-800 border-r p-1 last:border-r-0",
                CELL_MIN_W,
                CELL_MAX_W,
              ].join(" ")}
            >
              <div className="aspect-[4/3] w-full animate-pulse rounded bg-gray-900" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
