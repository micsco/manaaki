import { mdiWaterOutline } from "@mdi/js"

import type { DailyForecast } from "../weather/forecast"
import { weatherCondition, weatherLocation } from "../weather/forecast"
import type { useWeather } from "../weather/useWeather"
import { Icon } from "./Icon"
import { WeatherConditionIcon } from "./WeatherConditionIcon"

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
      <a
        href="/weather-icons-license.txt"
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-4 hover:text-white"
      >
        QWeather icons
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
    <div className="mb-3 space-y-2">
      <p
        className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-400"
        aria-label="Daily weather"
      >
        <span className="inline-flex items-center gap-2">
          <WeatherConditionIcon code={forecast.code} />
          {weatherCondition(forecast.code)}
        </span>
        <span className="whitespace-nowrap">
          <span className="text-gray-200">High {Math.round(forecast.high)}°C</span> · Low{" "}
          {Math.round(forecast.low)}°C
        </span>
        {forecast.rain !== null && (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <Icon path={mdiWaterOutline} size="16px" aria-hidden />
            {Math.round(forecast.rain)}% chance of rain
          </span>
        )}
      </p>
      {forecast.dinner && (
        <p
          className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-400"
          aria-label="Weather around 7pm"
        >
          <span className="font-medium text-orange-300">Around 7pm</span>
          <span className="inline-flex items-center gap-2">
            <WeatherConditionIcon code={forecast.dinner.code} isDay={forecast.dinner.isDay} />
            {weatherCondition(forecast.dinner.code)}
          </span>
          <span className="text-gray-200">{Math.round(forecast.dinner.temperature)}°C</span>
          {forecast.dinner.rain !== null && (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <Icon path={mdiWaterOutline} size="16px" aria-hidden />
              {Math.round(forecast.dinner.rain)}% chance of rain
            </span>
          )}
        </p>
      )}
    </div>
  )
}
