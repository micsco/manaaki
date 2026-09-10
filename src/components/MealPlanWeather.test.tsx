import userEvent from "@testing-library/user-event"
import { expect, it, vi } from "vitest"

import { render, screen } from "../test/render"
import { weatherCacheTtl } from "../weather/forecast"
import { MealPlanDayWeather, MealPlanWeatherStatus } from "./MealPlanWeather"

it("shows conditions, temperatures and a zero rain chance", () => {
  render(
    <MealPlanDayWeather
      available
      forecast={{ date: "2026-09-10", code: 2, high: 21.2, low: 12.3, rain: 0 }}
    />
  )
  expect(screen.getByLabelText("Daily weather")).toHaveTextContent("Partly cloudy")
  expect(screen.getByText("High 21°C")).toBeInTheDocument()
  expect(screen.getByText("0% chance of rain")).toBeInTheDocument()
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
it("labels saved forecasts and their London update time", () => {
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
  expect(screen.getByText(/Saved forecast/)).toHaveTextContent("London time")
  expect(screen.getByText(/Refresh unavailable/)).toBeInTheDocument()
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
