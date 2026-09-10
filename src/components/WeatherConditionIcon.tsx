import { weatherCondition } from "../weather/forecast"
import icons from "../weather/qweather-icons.json"

export function WeatherConditionIcon({ code, isDay = true }: { code: number; isDay?: boolean }) {
  const condition = weatherCondition(code) as keyof typeof icons
  const nightCondition = `${condition} night`
  const paths =
    !isDay && nightCondition in icons
      ? icons[nightCondition as keyof typeof icons]
      : icons[condition]
  return (
    <svg
      viewBox="0 0 16 16"
      width="24"
      height="24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className="size-6 shrink-0 text-gray-300"
    >
      {paths.map(path => (
        <path key={path.d} d={path.d} />
      ))}
    </svg>
  )
}
