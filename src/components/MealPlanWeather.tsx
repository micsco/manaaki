import { mdiChevronDown } from "@mdi/js"

import type { DailyForecast } from "../weather/forecast"
import { weatherCondition, weatherLocation } from "../weather/forecast"
import type { useWeather } from "../weather/useWeather"
import { Icon } from "./Icon"
import { WeatherConditionIcon } from "./WeatherConditionIcon"

export function MealPlanWeatherStatus({ weather }: { weather: ReturnType<typeof useWeather> }) {
  const { snapshot, isPending, isFetching, isStale, refresh } = weather
  return (
    <div className="border-t border-gray-800 pt-2 text-xs text-gray-400">
      <details>
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 hover:text-white [&::-webkit-details-marker]:hidden">
          Weather · {weatherLocation.name} · °C
          {snapshot && isStale && <span>· Saved forecast · Refresh unavailable</span>}
          <Icon path={mdiChevronDown} size={0.65} aria-hidden />
        </summary>
        <div className="space-y-2 pb-3">
          <p>7pm forecasts use London local time.</p>
          {snapshot && (
            <p>
              Updated{" "}
              {new Date(snapshot.fetchedAt).toLocaleString("en-GB", {
                timeZone: weatherLocation.timezone,
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              London time
            </p>
          )}
          <p className="flex gap-3">
            <a
              href="https://open-meteo.com/"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4 hover:text-white"
            >
              Open-Meteo
            </a>
            <a
              href="/weather-icons-license.txt"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4 hover:text-white"
            >
              QWeather icons
            </a>
          </p>
        </div>
      </details>
      {!snapshot &&
        (isPending ? (
          <p role="status" className="pb-2">
            Loading forecast…
          </p>
        ) : (
          <p>
            Forecast unavailable ·{" "}
            <button
              type="button"
              onClick={refresh}
              disabled={isFetching}
              className="min-h-11 underline underline-offset-4 hover:text-white disabled:opacity-50"
            >
              Retry weather
            </button>
          </p>
        ))}
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
      <p className="text-xs text-gray-400">Forecast not available for this date.</p>
    ) : null
  return (
    <details className="group/weather text-sm text-gray-300">
      <summary className="flex min-h-11 cursor-pointer list-none items-start gap-2 rounded-sm hover:text-white [&::-webkit-details-marker]:hidden">
        <span className="block min-w-0 space-y-1">
          <span aria-label="Daily weather" className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <WeatherConditionIcon code={forecast.code} />
            <span>{weatherCondition(forecast.code)}</span>
            <span className="whitespace-nowrap">
              High {Math.round(forecast.high)}°C · Low {Math.round(forecast.low)}°C
            </span>
          </span>
          {forecast.dinner && (
            <span aria-label="Weather around 7pm" className="block text-xs text-gray-400">
              7pm: {Math.round(forecast.dinner.temperature)}°C
              {forecast.dinner.rain !== null && <> · Rain {Math.round(forecast.dinner.rain)}%</>}
            </span>
          )}
        </span>
        <Icon
          path={mdiChevronDown}
          size={0.65}
          aria-hidden
          className="mt-1 shrink-0 group-open/weather:rotate-180"
        />
      </summary>
      <div className="mt-2 space-y-2 rounded-lg bg-gray-900 p-3 text-xs text-gray-400">
        {forecast.rain !== null && (
          <p>Day: peak hourly chance of rain {Math.round(forecast.rain)}%</p>
        )}
        {forecast.dinner ? (
          <>
            <p>
              Around 7pm: {weatherCondition(forecast.dinner.code)} ·{" "}
              {Math.round(forecast.dinner.temperature)}°C
            </p>
            {forecast.dinner.rain !== null && (
              <p>{Math.round(forecast.dinner.rain)}% chance of rain at 7pm</p>
            )}
          </>
        ) : (
          <p>7pm forecast unavailable.</p>
        )}
      </div>
    </details>
  )
}
