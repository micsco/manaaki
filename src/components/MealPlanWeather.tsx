import type { DailyForecast } from "../weather/forecast"
import { weatherCondition, weatherLocation } from "../weather/forecast"
import type { useWeather } from "../weather/useWeather"

export function MealPlanWeatherStatus({ weather }: { weather: ReturnType<typeof useWeather> }) {
  const { snapshot, isPending, isFetching, isStale, refresh } = weather
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-400">
      <span>Weather · {weatherLocation.name}</span>
      {snapshot ? (
        <>
          <span>
            · {isStale ? "Saved forecast · " : ""}Updated{" "}
            {new Date(snapshot.fetchedAt).toLocaleString("en-GB", {
              timeZone: weatherLocation.timezone,
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            London time
          </span>
          {isStale && <span>· Refresh unavailable</span>}
        </>
      ) : isPending ? (
        <span role="status">· Loading forecast…</span>
      ) : (
        <>
          <span>· Forecast unavailable</span>
          <button
            type="button"
            onClick={refresh}
            disabled={isFetching}
            className="min-h-11 underline underline-offset-4 hover:text-white disabled:opacity-50"
          >
            Retry weather
          </button>
        </>
      )}
      <a
        href="https://open-meteo.com/"
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-4 hover:text-white"
      >
        Open-Meteo
      </a>
    </div>
  )
}

export function MealPlanDayWeather({
  forecast,
  available,
}: {
  forecast?: DailyForecast
  available: boolean
}) {
  if (!forecast)
    return available ? (
      <p className="mb-3 text-xs text-gray-500">Forecast not available for this date.</p>
    ) : null
  return (
    <p
      className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400"
      aria-label="Daily weather"
    >
      <span>{weatherCondition(forecast.code)}</span>
      <span>
        <span className="text-gray-200">High {Math.round(forecast.high)}°C</span> · Low{" "}
        {Math.round(forecast.low)}°C
      </span>
      {forecast.rain !== null && <span>{Math.round(forecast.rain)}% chance of rain</span>}
    </p>
  )
}
