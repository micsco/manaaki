const DAY_ABBREVS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

interface Day {
  isoDate: string
  dayAbbrev: string
  dayNumber: number
  isToday: boolean
}

export function buildWeekDays(startDate: string, todayIso: string): Day[] {
  const days: Day[] = []
  const base = new Date(`${startDate}T00:00:00`)

  for (let i = 0; i < 7; i++) {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    const isoDate = `${y}-${m}-${day}`

    days.push({
      isoDate,
      dayAbbrev: DAY_ABBREVS[d.getDay()],
      dayNumber: d.getDate(),
      isToday: isoDate === todayIso,
    })
  }

  return days
}

interface MealPlanDayStripProps {
  startDate: string
  todayIso: string
  selectedDay: string
  onSelectDay: (isoDate: string) => void
}

export function MealPlanDayStrip({
  startDate,
  todayIso,
  selectedDay,
  onSelectDay,
}: MealPlanDayStripProps) {
  const days = buildWeekDays(startDate, todayIso)

  return (
    <div className="flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Day selector">
      {days.map(day => {
        const isSelected = day.isoDate === selectedDay
        return (
          <button
            type="button"
            key={day.isoDate}
            role="tab"
            aria-selected={isSelected}
            aria-label={day.isoDate}
            onClick={() => onSelectDay(day.isoDate)}
            className={[
              "flex min-w-[3.5rem] flex-1 flex-col items-center rounded-xl px-2 py-2 transition-colors",
              isSelected
                ? "bg-orange-600 text-white"
                : day.isToday
                  ? "bg-gray-700 text-white ring-1 ring-orange-500"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700",
            ].join(" ")}
          >
            <span className="font-medium text-xs">{day.dayAbbrev}</span>
            <span className="mt-0.5 font-semibold text-sm leading-none">{day.dayNumber}</span>
          </button>
        )
      })}
    </div>
  )
}
