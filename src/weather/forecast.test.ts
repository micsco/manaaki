import { afterEach, beforeEach, expect, it, vi } from "vitest"

import {
  loadWeather,
  normalizeForecast,
  readWeatherCache,
  weatherCacheKey,
  weatherCacheTtl,
  weatherCondition,
  weatherMaxAge,
} from "./forecast"

const day = { date: "2026-09-10", code: 3, high: 21, low: 12, rain: 40 }
const response = {
  daily: {
    time: [day.date],
    weather_code: [3],
    temperature_2m_max: [21],
    temperature_2m_min: [12],
    precipitation_probability_max: [40],
  },
}
const fetchMock = vi.fn()
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => response })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})
function cache(age: number) {
  const snapshot = { version: 1, fetchedAt: Date.now() - age, days: [day] }
  localStorage.setItem(weatherCacheKey, JSON.stringify(snapshot))
  return snapshot
}
it("normalizes dates and preserves zero rain without inventing missing data", () => {
  expect(normalizeForecast(response)).toEqual([day])
  expect(
    normalizeForecast({ daily: { ...response.daily, precipitation_probability_max: [0] } })[0].rain
  ).toBe(0)
  expect(
    normalizeForecast({ daily: { ...response.daily, precipitation_probability_max: [null] } })[0]
      .rain
  ).toBeNull()
  expect(normalizeForecast({ daily: { ...response.daily, temperature_2m_max: [null] } })).toEqual(
    []
  )
  expect(normalizeForecast(null)).toEqual([])
})
it("reuses a six-hour browser cache without fetching", async () => {
  const snapshot = cache(weatherCacheTtl - 1000)
  expect(await loadWeather()).toEqual(snapshot)
  expect(fetchMock).not.toHaveBeenCalled()
})
it("refreshes expired data with one London forecast and saves normalized results", async () => {
  cache(weatherCacheTtl)
  expect((await loadWeather()).days).toEqual([day])
  const url = new URL(fetchMock.mock.calls[0][0])
  expect(url.origin).toBe("https://api.open-meteo.com")
  expect(url.searchParams.get("timezone")).toBe("Europe/London")
  expect(url.searchParams.get("forecast_days")).toBe("16")
  expect(url.searchParams.get("latitude")).toBe("51.461")
  expect(readWeatherCache()?.days).toEqual([day])
})
it("retains the original timestamp when offline and rejects data older than 48 hours", async () => {
  fetchMock.mockRejectedValue(new Error("Offline"))
  const snapshot = cache(weatherCacheTtl + 1)
  expect(await loadWeather()).toEqual(snapshot)
  cache(weatherMaxAge)
  await expect(loadWeather()).rejects.toThrow("Offline")
})
it("ignores corrupt, wrong-version and future-dated caches", async () => {
  for (const value of [
    "{",
    "null",
    JSON.stringify({ version: 2 }),
    JSON.stringify({ version: 1, fetchedAt: Date.now(), days: [{}] }),
    JSON.stringify({ version: 1, fetchedAt: Date.now() + 100000, days: [day] }),
  ]) {
    localStorage.setItem(weatherCacheKey, value)
    expect(readWeatherCache()).toBeNull()
  }
  expect((await loadWeather()).days).toEqual([day])
})
it("still returns live weather when browser storage is blocked", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("Blocked")
  })
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("Full")
  })
  expect((await loadWeather()).days).toEqual([day])
})
it("falls back on HTTP errors or unusable responses", async () => {
  const snapshot = cache(weatherCacheTtl + 1)
  fetchMock.mockResolvedValue({ ok: false })
  expect(await loadWeather()).toEqual(snapshot)
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ daily: { time: [] } }) })
  expect(await loadWeather()).toEqual(snapshot)
})
it("aborts a stalled request after eight seconds", async () => {
  vi.useFakeTimers()
  fetchMock.mockImplementation(
    (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("Aborted")))
      })
  )
  await Promise.all([
    expect(loadWeather()).rejects.toThrow("Aborted"),
    vi.advanceTimersByTimeAsync(8000),
  ])
})
it("describes showers, freezing rain and unknown codes accurately", () => {
  expect(weatherCondition(80)).toBe("Showers")
  expect(weatherCondition(66)).toBe("Freezing rain")
  expect(weatherCondition(99)).toBe("Thunderstorms")
  expect(weatherCondition(-1)).toBe("Conditions unavailable")
})

it.each(["2026-07-10", "2026-12-10"])(
  "selects 19:00 London-local time for %s without a browser timezone conversion",
  date => {
    const result = normalizeForecast({
      daily: { ...response.daily, time: [date] },
      hourly: {
        time: [`${date}T18:00`, `${date}T19:00`, `${date}T20:00`],
        temperature_2m: [20, 18, 16],
        weather_code: [3, 2, 0],
        precipitation_probability: [50, 10, 0],
        is_day: [1, 0, 0],
      },
    })
    expect(result[0].dinner).toEqual({ temperature: 18, code: 2, rain: 10, isDay: false })
  }
)
it("preserves the daily forecast when the dinner hour is missing or incomplete", () => {
  for (const hourly of [
    {},
    { time: ["2026-09-10T18:00"], temperature_2m: [20] },
    { time: ["2026-09-10T19:00"], temperature_2m: [null], weather_code: [2], is_day: [1] },
  ]) {
    expect(normalizeForecast({ ...response, hourly })).toEqual([day])
  }
})
it("keeps dinner weather when hourly rain probability is missing", () => {
  const result = normalizeForecast({
    ...response,
    hourly: { time: [`${day.date}T19:00`], temperature_2m: [18], weather_code: [2], is_day: [1] },
  })
  expect(result[0].dinner).toEqual({ temperature: 18, code: 2, rain: null, isDay: true })
})
it("rejects corrupted dinner data in the browser cache", () => {
  localStorage.setItem(
    weatherCacheKey,
    JSON.stringify({
      version: 1,
      fetchedAt: Date.now(),
      days: [{ ...day, dinner: { temperature: "warm" } }],
    })
  )
  expect(readWeatherCache()).toBeNull()
})
