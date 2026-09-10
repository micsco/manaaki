import userEvent from "@testing-library/user-event"
import { expect, it, vi } from "vitest"

import { render, screen } from "../test/render"
import { weatherCacheTtl } from "../weather/forecast"
import { MealPlanDayWeather, MealPlanWeatherStatus } from "./MealPlanWeather"

it("keeps the daily range visible and discloses a zero rain chance", async () => {
  render(
    <MealPlanDayWeather
      available
      forecast={{ date: "2026-09-10", code: 2, high: 21.2, low: 12.3, rain: 0 }}
    />
  )
  expect(screen.getByLabelText("Daily weather")).toHaveTextContent("Partly cloudy")
  expect(screen.getByText(/High 21°C/)).toBeInTheDocument()
  expect(screen.getByText(/peak hourly chance of rain 0%/)).not.toBeVisible()
  await userEvent.setup().click(screen.getByLabelText("Daily weather"))
  expect(screen.getByText(/peak hourly chance of rain 0%/)).toBeVisible()
  expect(screen.queryByRole("img")).not.toBeInTheDocument()
})
it("does not describe missing rain data as dry", () => {
  render(
    <MealPlanDayWeather
      available
      forecast={{ date: "2026-09-10", code: 3, high: 20, low: 10, rain: null }}
    />
  )
  expect(screen.queryByText(/chance of rain/)).not.toBeInTheDocument()
})
it("explains dates missing from the forecast", () => {
  render(<MealPlanDayWeather available />)
  expect(screen.getByText("Forecast not available for this date.")).toBeInTheDocument()
})
it("keeps stale status visible and discloses update time and credits", async () => {
  render(
    <MealPlanWeatherStatus
      weather={{
        snapshot: { version: 1, fetchedAt: Date.now() - weatherCacheTtl - 1000, days: [] },
        isStale: true,
        isPending: false,
        isFetching: false,
        refresh: vi.fn(),
      }}
    />
  )
  expect(screen.getByText(/Saved forecast/)).toBeVisible()
  expect(screen.getByText(/Updated/)).not.toBeVisible()
  await userEvent.setup().click(screen.getByText(/Weather · Lewisham/))
  expect(screen.getByText(/Updated/)).toHaveTextContent("London time")
  expect(screen.getByText(/Refresh unavailable/)).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "QWeather icons" })).toHaveAttribute(
    "href",
    "/weather-icons-license.txt"
  )
  expect(screen.getByRole("link", { name: "Open-Meteo" })).toHaveAttribute(
    "href",
    "https://open-meteo.com/"
  )
})
it("offers weather recovery independently of meals", async () => {
  const refresh = vi.fn()
  render(
    <MealPlanWeatherStatus
      weather={{ snapshot: undefined, isStale: true, isPending: false, isFetching: false, refresh }}
    />
  )
  await userEvent.setup().click(screen.getByRole("button", { name: "Retry weather" }))
  expect(refresh).toHaveBeenCalledOnce()
})
it("shows a loading status", () => {
  render(
    <MealPlanWeatherStatus
      weather={{
        snapshot: undefined,
        isStale: false,
        isPending: true,
        isFetching: true,
        refresh: vi.fn(),
      }}
    />
  )
  expect(screen.getByRole("status")).toHaveTextContent("Loading forecast")
})

it("leads with daily conditions and keeps evening detail on demand", async () => {
  render(
    <MealPlanDayWeather
      available
      forecast={{
        date: "2026-09-10",
        code: 3,
        high: 21,
        low: 12,
        rain: 70,
        dinner: { temperature: 18, code: 0, rain: 10, isDay: false },
      }}
    />
  )
  expect(screen.getByLabelText("Daily weather")).toHaveTextContent("Cloudy")
  expect(screen.getByLabelText("Daily weather")).toHaveTextContent("High 21°C")
  expect(screen.getByLabelText("Weather around 7pm")).toHaveTextContent("7pm: 18°C · Rain 10%")
  expect(screen.getByText(/Around 7pm: Clear/)).not.toBeVisible()
  await userEvent.setup().click(screen.getByLabelText("Daily weather"))
  expect(screen.getByText(/Around 7pm: Clear/)).toBeVisible()
})
it("does not invent dinner conditions when hourly data is missing", () => {
  render(
    <MealPlanDayWeather
      available
      forecast={{ date: "2026-09-10", code: 3, high: 21, low: 12, rain: 70 }}
    />
  )
  expect(screen.queryByLabelText("Weather around 7pm")).not.toBeInTheDocument()
})
