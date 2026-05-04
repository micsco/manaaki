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
    const { startDate, endDate } = multiWeekBounds(-1, 1)
    return void queryClient.ensureQueryData(mealPlanQueryOptions(startDate, endDate))
  },
  component: PlanPage,
})

const DAY_ABBREVS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
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

const SHOWN_MEAL_TYPES = ["lunch", "dinner"] as const
type ShownMealType = (typeof SHOWN_MEAL_TYPES)[number]

function weekMonday(weekOffset: number): Date {
  return new Date(`${isoWeekBounds(weekOffset).startDate}T00:00:00`)
}

function dayLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`)
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`
}

const CELL_MIN_W = "min-w-[140px]"

function EmptyMealSlot({ mealType }: { mealType: ShownMealType }) {
  return (
    <div className="relative aspect-[16/9] w-full bg-gray-900/30">
      <div className="absolute inset-0 flex flex-col">
        <div className="border-gray-800/60 border-b px-2 py-1">
          <span className="font-semibold text-[10px] text-gray-700 uppercase tracking-widest">
            {mealType}
          </span>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <span className="text-gray-700 text-xs">—</span>
        </div>
      </div>
    </div>
  )
}

function MealSlot({
  entry,
  mealType,
  dateLabel,
  todayIso,
  isoDate,
}: {
  entry: ReadPlanEntry
  mealType: ShownMealType
  dateLabel: string
  todayIso: string
  isoDate: string
}) {
  const eyebrow = `${isoDate === todayIso ? "Today" : dateLabel} · ${mealType.charAt(0).toUpperCase() + mealType.slice(1)}`
  return <MealPlanEntryCard entry={entry} dayLabel={eyebrow} compact />
}

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
    const dayEntries = entries.filter(e => e.date === isoDate)
    const byType = Object.fromEntries(
      SHOWN_MEAL_TYPES.map(t => [t, dayEntries.find(e => e.entryType === t) ?? null])
    ) as Record<ShownMealType, ReadPlanEntry | null>
    return { isoDate, isToday, byType }
  })

  return (
    <div className="flex border-gray-800 border-b">
      {cells.map(({ isoDate, isToday, byType }) => (
        <div
          key={isoDate}
          ref={isToday ? todayRef : undefined}
          className={[
            "flex flex-1 flex-col border-gray-800 border-r last:border-r-0",
            CELL_MIN_W,
            isToday ? "bg-orange-950/20" : "",
          ].join(" ")}
        >
          <div
            className={[
              "border-b px-2 py-1 text-center",
              isToday ? "border-orange-800/40 bg-orange-950/30" : "border-gray-800 bg-gray-900/50",
            ].join(" ")}
          >
            <span
              className={[
                "font-semibold text-xs",
                isToday ? "text-orange-400" : "text-gray-500",
              ].join(" ")}
            >
              {dayLabel(isoDate)}
            </span>
          </div>

          <div>
            {SHOWN_MEAL_TYPES.map((mealType, idx) => {
              const entry = byType[mealType]
              return (
                <div
                  key={mealType}
                  className={idx < SHOWN_MEAL_TYPES.length - 1 ? "border-gray-800 border-b" : ""}
                >
                  {entry ? (
                    <MealSlot
                      entry={entry}
                      mealType={mealType}
                      dateLabel={dayLabel(isoDate)}
                      todayIso={todayIso}
                      isoDate={isoDate}
                    />
                  ) : (
                    <EmptyMealSlot mealType={mealType} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function PlanPage() {
  const today = todayIsoDateString()

  const [startOffset, setStartOffset] = useState(-1)
  const [endOffset, setEndOffset] = useState(1)

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
  const hasScrolledToToday = useRef(false)

  useEffect(() => {
    if (!isLoading && !hasScrolledToToday.current && todayRef.current) {
      todayRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" })
      hasScrolledToToday.current = true
    }
  }, [isLoading])

  const loadPast = useCallback(() => {
    setStartOffset(prev => prev - 1)
  }, [])

  useEffect(() => {
    const sentinel = bottomSentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadPast()
      },
      { threshold: 0.1 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadPast])

  const weekOffsets = Array.from({ length: endOffset - startOffset + 1 }, (_, i) => endOffset - i)

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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEndOffset(prev => prev + 1)}
              disabled={isFetching}
              className="rounded-full bg-gray-800 px-3 py-1.5 font-medium text-gray-300 text-sm transition-colors hover:bg-gray-700 disabled:opacity-50"
            >
              Load future week
            </button>
            <button
              type="button"
              onClick={() => {
                todayRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
              }}
              className="rounded-full bg-orange-600 px-3 py-1.5 font-medium text-sm text-white transition-colors hover:bg-orange-500"
            >
              Today
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: `${7 * 140}px` }}>
          <div className="sticky top-[57px] z-20 flex border-gray-800 border-b bg-gray-950/95 backdrop-blur-sm">
            {DAY_ABBREVS.map(day => (
              <div
                key={day}
                className={[
                  "flex flex-1 items-center justify-center py-2 font-semibold text-gray-400 text-xs uppercase tracking-wider",
                  CELL_MIN_W,
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
      {(["a", "b", "c"] as const).map(k => (
        <div key={k} className="flex border-gray-800 border-b">
          {DAY_ABBREVS.map(day => (
            <div
              key={day}
              className={["flex-1 border-gray-800 border-r p-1 last:border-r-0", CELL_MIN_W].join(
                " "
              )}
            >
              <div className="aspect-[16/9] w-full animate-pulse rounded bg-gray-900" />
              <div className="mt-px aspect-[16/9] w-full animate-pulse rounded bg-gray-900" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
