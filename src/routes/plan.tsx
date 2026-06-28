import { mdiChevronLeft } from "@mdi/js"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router"
import { useCallback, useEffect, useRef, useState } from "react"
import { fetchCurrentUser } from "../api/auth"
import type { ReadPlanEntry } from "../api/generated/types.gen"
import { BuildShoppingListDialog } from "../components/BuildShoppingListDialog"
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
  head: () => ({ meta: [{ title: "Meal Plan · Manaaki" }] }),
  beforeLoad: async () => {
    const { isAnonymous } = await fetchCurrentUser()
    if (isAnonymous) {
      throw redirect({ href: "/api/auth/oauth" })
    }
  },
  component: PlanPage,
})

const DAY_ABBREVS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const monthFormatter = new Intl.DateTimeFormat("en", { month: "short" })

const SHOWN_MEAL_TYPES = ["lunch", "dinner"] as const
type ShownMealType = (typeof SHOWN_MEAL_TYPES)[number]

function weekMonday(weekOffset: number): Date {
  return new Date(`${isoWeekBounds(weekOffset).startDate}T00:00:00`)
}

function dayLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`)
  return `${d.getDate()} ${monthFormatter.format(d)}`
}

function todayDayIndex(): number {
  const jsDay = new Date().getDay()
  return (jsDay + 6) % 7
}

const CELL_MIN_W = "min-w-[140px]"

function EmptyMealSlot({ mealType }: { mealType: ShownMealType }) {
  return (
    <div className="relative aspect-[16/9] w-full bg-gray-900/30">
      <div className="absolute bottom-0 left-0 px-2 py-1.5">
        <span className="font-semibold text-[10px] text-gray-700 uppercase tracking-widest">
          {mealType}
        </span>
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
  todayIso: string | null
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
  isFirst,
  sentinelMapRef,
}: {
  weekOffset: number
  entries: ReadPlanEntry[]
  todayIso: string | null
  todayRef?: React.RefObject<HTMLDivElement | null>
  isFirst?: boolean
  sentinelMapRef?: React.RefObject<Map<number, HTMLDivElement>>
}) {
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !sentinelMapRef) return
    sentinelMapRef.current.set(weekOffset, el)
    return () => {
      sentinelMapRef.current.delete(weekOffset)
    }
  }, [weekOffset, sentinelMapRef])

  const isCurrentWeek = weekOffset === 0
  const monday = weekMonday(weekOffset)
  const cells = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const isoDate = toIsoDateString(d)
    const isToday = todayIso !== null && isoDate === todayIso
    const dayEntries = entries.filter(e => e.date === isoDate)
    const byType = Object.fromEntries(
      SHOWN_MEAL_TYPES.map(t => [t, dayEntries.find(e => e.entryType === t) ?? null])
    ) as Record<ShownMealType, ReadPlanEntry | null>
    return { isoDate, isToday, byType }
  })

  const weekBorderClass = isCurrentWeek
    ? "border-orange-800/60 border-b-2"
    : "border-gray-700/50 border-b"

  return (
    <div>
      <div ref={sentinelRef} />
      <div
        className={[
          "week-date-row sticky top-[81px] z-10 overflow-x-auto",
          isFirst ? "week-date-row--first" : "",
          isCurrentWeek ? "bg-orange-950" : "bg-gray-900",
        ].join(" ")}
      >
        <div
          className={["week-date-row__border flex", weekBorderClass].join(" ")}
          style={{ minWidth: `${7 * 140}px` }}
        >
          {cells.map(({ isoDate, isToday }) => (
            <div
              key={isoDate}
              ref={isToday ? todayRef : undefined}
              className={[
                "week-date-row__cell flex flex-1 items-center justify-center border-gray-800/50 border-r py-1.5 last:border-r-0",
                CELL_MIN_W,
                isToday ? "bg-orange-500/10" : "",
              ].join(" ")}
            >
              <span
                className={[
                  "font-semibold text-xs",
                  isToday ? "text-orange-400" : isCurrentWeek ? "text-gray-300" : "text-gray-500",
                ].join(" ")}
              >
                {dayLabel(isoDate)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-[1] overflow-x-auto bg-gray-950">
        <div
          className={["flex", isCurrentWeek ? "bg-orange-950/5" : ""].join(" ")}
          style={{ minWidth: `${7 * 140}px` }}
        >
          {cells.map(({ isoDate, isToday, byType }) => (
            <div
              key={isoDate}
              className={[
                "flex flex-1 flex-col border-gray-800/50 border-r last:border-r-0",
                CELL_MIN_W,
                isToday ? "bg-orange-950/20" : "",
              ].join(" ")}
            >
              {SHOWN_MEAL_TYPES.map((mealType, idx) => {
                const entry = byType[mealType]
                return (
                  <div
                    key={mealType}
                    className={
                      idx < SHOWN_MEAL_TYPES.length - 1 ? "border-gray-800/50 border-b" : ""
                    }
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
          ))}
        </div>
      </div>
    </div>
  )
}

function PlanPage() {
  const navigate = useNavigate()
  const [buildOpen, setBuildOpen] = useState(false)
  const [today, setToday] = useState<string | null>(null)
  const [todayColIndex, setTodayColIndex] = useState<number | null>(null)

  useEffect(() => {
    setToday(todayIsoDateString())
    setTodayColIndex(todayDayIndex())
  }, [])

  const [startOffset, setStartOffset] = useState(-1)
  const [endOffset, setEndOffset] = useState(0)

  const fetchEnd = Math.max(endOffset, 1)
  const { startDate, endDate } = multiWeekBounds(startOffset, fetchEnd)
  const {
    data: entries = [],
    isLoading,
    isFetching,
  } = useQuery({
    ...mealPlanQueryOptions(startDate, endDate),
    placeholderData: keepPreviousData,
  })

  const { startDate: nextWeekStart, endDate: nextWeekEnd } = multiWeekBounds(1, 1)
  const nextWeekHasEntries = entries.some(e => e.date >= nextWeekStart && e.date <= nextWeekEnd)
  const effectiveEndOffset = endOffset === 0 && nextWeekHasEntries ? 1 : endOffset

  const sentinelMapRef = useRef<Map<number, HTMLDivElement>>(new Map())
  const [stuckWeekOffset, setStuckWeekOffset] = useState<number>(0)

  useEffect(() => {
    const STICKY_TOP = 81
    let rafId: number | null = null

    function onScroll() {
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        const threshold = window.scrollY + STICKY_TOP
        let bestOffset = 0
        let bestTop = -Infinity
        for (const [offset, el] of sentinelMapRef.current) {
          const top = el.getBoundingClientRect().top + window.scrollY
          if (top <= threshold && top > bestTop) {
            bestTop = top
            bestOffset = offset
          }
        }
        setStuckWeekOffset(bestOffset)
      })
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [])

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

  const weekCount = effectiveEndOffset - startOffset + 1
  const weekOffsets = Array.from({ length: weekCount }, (_, i) => effectiveEndOffset - i)

  useEffect(() => {
    if (isFetching || weekCount < 1) return

    function ensureOverflow() {
      if (document.documentElement.scrollHeight <= window.innerHeight) {
        loadPast()
      }
    }

    ensureOverflow()

    window.addEventListener("resize", ensureOverflow)
    return () => window.removeEventListener("resize", ensureOverflow)
  }, [weekCount, isFetching, loadPast])

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <div className="fixed top-0 right-0 left-0 z-30 border-gray-800 border-b bg-gray-950/95 backdrop-blur-sm">
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
              onClick={() => setBuildOpen(true)}
              className="rounded-full bg-gray-800 px-3 py-1.5 font-medium text-gray-300 text-sm transition-colors hover:bg-gray-700"
            >
              Build shopping list
            </button>
            <button
              type="button"
              onClick={() => setEndOffset(effectiveEndOffset + 1)}
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

      <div
        aria-hidden="true"
        className={[
          "fixed top-[81px] right-0 bottom-0 left-0 z-0",
          stuckWeekOffset === 0 ? "bg-orange-950" : "bg-gray-900",
        ].join(" ")}
      />
      {stuckWeekOffset === 0 && todayColIndex !== null && (
        <div
          aria-hidden="true"
          className="fixed top-[81px] bottom-0 z-0 bg-orange-500/10"
          style={{
            left: `calc(100% / 7 * ${todayColIndex})`,
            width: "calc(100% / 7)",
          }}
        />
      )}

      <div
        className={[
          "fixed top-[57px] right-0 left-0 z-20 overflow-x-auto",
          stuckWeekOffset === 0 ? "bg-orange-950" : "bg-gray-900",
        ].join(" ")}
      >
        <div className="flex" style={{ minWidth: `${7 * 140}px` }}>
          {DAY_ABBREVS.map((day, i) => {
            const isToday = stuckWeekOffset === 0 && todayColIndex !== null && i === todayColIndex
            return (
              <div
                key={day}
                className={[
                  "flex flex-1 items-center justify-center border-gray-800/50 border-r pt-2 last:border-r-0",
                  CELL_MIN_W,
                  isToday ? "bg-orange-500/10" : "",
                ].join(" ")}
              >
                <span
                  className={[
                    "font-semibold text-xs uppercase tracking-wider",
                    isToday ? "text-orange-400" : "text-gray-500",
                  ].join(" ")}
                >
                  {day}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="pt-[81px]">
        {isLoading ? (
          <LoadingSkeleton />
        ) : (
          <>
            {weekOffsets.map((offset, i) => (
              <WeekRow
                key={offset}
                weekOffset={offset}
                entries={entries}
                todayIso={today}
                todayRef={offset === 0 ? todayRef : undefined}
                isFirst={i === 0}
                sentinelMapRef={sentinelMapRef}
              />
            ))}

            <div ref={bottomSentinelRef} className="flex justify-center py-4">
              {isFetching && <span className="text-gray-500 text-xs">Loading…</span>}
            </div>
          </>
        )}
      </div>
      <BuildShoppingListDialog
        open={buildOpen}
        onClose={() => setBuildOpen(false)}
        onBuilt={({ listId }) => {
          setBuildOpen(false)
          navigate({ to: "/shopping", search: { list: listId } })
        }}
      />
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
