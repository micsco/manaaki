import { expect, it } from "vitest"

import { render, screen } from "../test/render"
import icons from "../weather/qweather-icons.json"
import { WeatherConditionIcon } from "./WeatherConditionIcon"

it.each([
  [0, "Clear"],
  [1, "Mostly clear"],
  [2, "Partly cloudy"],
  [3, "Cloudy"],
  [45, "Fog"],
  [48, "Fog"],
  [51, "Drizzle"],
  [53, "Drizzle"],
  [55, "Drizzle"],
  [56, "Freezing rain"],
  [57, "Freezing rain"],
  [66, "Freezing rain"],
  [67, "Freezing rain"],
  [61, "Rain"],
  [63, "Rain"],
  [65, "Rain"],
  [71, "Snow"],
  [73, "Snow"],
  [75, "Snow"],
  [77, "Snow"],
  [80, "Showers"],
  [81, "Showers"],
  [82, "Showers"],
  [85, "Snow showers"],
  [86, "Snow showers"],
  [95, "Thunderstorms"],
  [96, "Thunderstorms"],
  [99, "Thunderstorms"],
  [-1, "Conditions unavailable"],
] as const)("maps WMO code %s to %s artwork", (code, condition) => {
  render(
    <div data-testid="condition-icon">
      <WeatherConditionIcon code={code} />
    </div>
  )
  const svg = screen.getByTestId("condition-icon").querySelector("svg")!
  expect(svg.querySelector("path")).toHaveAttribute("d", icons[condition][0].d)
  expect(svg).toHaveAttribute("aria-hidden", "true")
  expect(svg).toHaveAttribute("viewBox", "0 0 16 16")
})

it("uses a moon for clear evenings", () => {
  render(
    <div data-testid="night-icon">
      <WeatherConditionIcon code={0} isDay={false} />
    </div>
  )
  expect(screen.getByTestId("night-icon").querySelector("path")).toHaveAttribute(
    "d",
    icons["Clear night"][0].d
  )
})
