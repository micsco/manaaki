export const weatherLocation = {
  name: "Lewisham SE13",
  latitude: 51.461,
  longitude: -0.01,
  timezone: "Europe/London",
}
export const weatherCacheKey = "manaaki-weather-lewisham-v1"
export const weatherCacheTtl = 6 * 60 * 60 * 1000
export const weatherMaxAge = 48 * 60 * 60 * 1000

export type DailyForecast = {
  date: string
  code: number
  high: number
  low: number
  rain: number | null
}
export type WeatherSnapshot = { version: 1; fetchedAt: number; days: DailyForecast[] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}
function isDay(value: unknown): value is DailyForecast {
  return (
    isRecord(value) &&
    typeof value.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.date) &&
    isNumber(value.code) &&
    isNumber(value.high) &&
    isNumber(value.low) &&
    value.low <= value.high &&
    (value.rain === null || (isNumber(value.rain) && value.rain >= 0 && value.rain <= 100))
  )
}

export function normalizeForecast(value: unknown): DailyForecast[] {
  if (!isRecord(value) || !isRecord(value.daily)) return []
  const daily = value.daily
  if (!Array.isArray(daily.time)) return []
  const numberAt = (key: string, index: number) => {
    const field = daily[key]
    return Array.isArray(field) && isNumber(field[index]) ? field[index] : null
  }
  return daily.time.flatMap((date, index) => {
    const day = {
      date,
      code: numberAt("weather_code", index),
      high: numberAt("temperature_2m_max", index),
      low: numberAt("temperature_2m_min", index),
      rain: numberAt("precipitation_probability_max", index),
    }
    return isDay(day) ? [day] : []
  })
}

export function readWeatherCache(): WeatherSnapshot | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(weatherCacheKey) ?? "null")
    if (
      !isRecord(value) ||
      value.version !== 1 ||
      !isNumber(value.fetchedAt) ||
      value.fetchedAt > Date.now() ||
      Date.now() - value.fetchedAt >= weatherMaxAge ||
      !Array.isArray(value.days) ||
      !value.days.length ||
      !value.days.every(isDay)
    )
      return null
    return { version: 1, fetchedAt: value.fetchedAt, days: value.days }
  } catch {
    return null
  }
}

export async function loadWeather(): Promise<WeatherSnapshot> {
  const cached = readWeatherCache()
  if (cached && Date.now() - cached.fetchedAt < weatherCacheTtl) return cached
  const params = new URLSearchParams({
    latitude: String(weatherLocation.latitude),
    longitude: String(weatherLocation.longitude),
    timezone: weatherLocation.timezone,
    forecast_days: "16",
    temperature_unit: "celsius",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
  })
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      signal: controller.signal,
      credentials: "omit",
    })
    if (!response.ok) throw new Error("Weather unavailable")
    const days = normalizeForecast(await response.json())
    if (!days.length) throw new Error("Weather unavailable")
    const snapshot: WeatherSnapshot = { version: 1, fetchedAt: Date.now(), days }
    try {
      localStorage.setItem(weatherCacheKey, JSON.stringify(snapshot))
    } catch {
      return snapshot
    }
    return snapshot
  } catch (error) {
    if (cached && Date.now() - cached.fetchedAt < weatherMaxAge) return cached
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export function weatherCondition(code: number): string {
  if (code === 0) return "Clear"
  if (code === 1) return "Mostly clear"
  if (code === 2) return "Partly cloudy"
  if (code === 3) return "Cloudy"
  if ([45, 48].includes(code)) return "Fog"
  if ([51, 53, 55].includes(code)) return "Drizzle"
  if ([56, 57, 66, 67].includes(code)) return "Freezing rain"
  if ([61, 63, 65].includes(code)) return "Rain"
  if ([71, 73, 75, 77].includes(code)) return "Snow"
  if ([80, 81, 82].includes(code)) return "Showers"
  if ([85, 86].includes(code)) return "Snow showers"
  if ([95, 96, 99].includes(code)) return "Thunderstorms"
  return "Conditions unavailable"
}
