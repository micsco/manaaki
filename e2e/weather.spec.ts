import { expect, test } from "@playwright/test"

test("meal weather fits mobile and desktop, reuses its cache and handles future dates", async ({
  page,
}) => {
  let weatherRequests = 0
  const date = "2026-09-10"
  await page.route("http://localhost:3000/api/**", route =>
    route.fulfill({
      json: route.request().url().includes("/auth/me")
        ? { user: { id: "weather-test", username: "Planner" }, isAnonymous: false }
        : {
            items: route.request().url().includes("/households/mealplans")
              ? [
                  {
                    id: 1,
                    date,
                    entryType: "dinner",
                    title: "Slow Cooker Thai Red Curry",
                    recipe: {
                      id: "123e4567-e89b-12d3-a456-426614174000",
                      slug: "thai-curry",
                      name: "Slow Cooker Thai Red Curry",
                      totalTime: "4 hours 10 minutes",
                    },
                  },
                ]
              : [],
          },
    })
  )
  await page.route("https://api.open-meteo.com/**", route => {
    weatherRequests++
    return route.fulfill({
      json: {
        hourly: {
          time: [`${date}T19:00`],
          temperature_2m: [18],
          weather_code: [0],
          precipitation_probability: [10],
          is_day: [0],
        },
        daily: {
          time: [date],
          weather_code: [2],
          temperature_2m_max: [21],
          temperature_2m_min: [12],
          precipitation_probability_max: [20],
        },
      },
    })
  })
  await page.route("**/api/media/recipes/**", route =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="144" height="108"><rect width="144" height="108" fill="#273444"/></svg>',
    })
  )
  await page.goto(`/plan?date=${date}`, { waitUntil: "load" })
  await expect(page.getByLabel("Daily weather")).toContainText("High 21°C")
  await expect(page.getByText("Weather · Lewisham SE13")).toBeVisible()
  await expect(page.getByLabel("Weather around 7pm")).toContainText("18°C")
  await page.getByText("Weather · Lewisham SE13", { exact: false }).click()
  await expect(page.getByRole("link", { name: "QWeather icons" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Slow Cooker Thai Red Curry" })).toBeVisible()
  await expect(page.getByLabel("Weather around 7pm")).toHaveCSS("text-align", "right")
  const weatherSummary = page.locator("summary").filter({ has: page.getByLabel("Daily weather") })
  await expect(page.getByLabel("Daily weather")).toHaveCSS("font-size", "13px")
  await expect(page.getByLabel("Daily weather").locator("svg")).toHaveCSS("width", "20px")
  const summaryBounds = await weatherSummary.boundingBox()
  expect(summaryBounds!.height).toBeGreaterThanOrEqual(44)
  const chevronBounds = await weatherSummary.locator(":scope > svg").boundingBox()
  expect(summaryBounds).not.toBeNull()
  expect(chevronBounds).not.toBeNull()
  expect(
    Math.abs(summaryBounds!.x + summaryBounds!.width - chevronBounds!.x - chevronBounds!.width)
  ).toBeLessThan(1)
  await page.screenshot({ path: "/tmp/manaaki-weather-desktop.png", fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByLabel("Weather around 7pm")).not.toHaveCSS("text-align", "right")
  await expect(page.getByText(/peak hourly chance of rain 20%/)).not.toBeVisible()
  await page.getByLabel("Daily weather").click()
  await expect(page.getByText(/peak hourly chance of rain 20%/)).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  )
  await page.screenshot({ path: "/tmp/manaaki-weather-mobile.png", fullPage: true })
  await page.getByRole("button", { name: "Adjust plan for Slow Cooker Thai Red Curry" }).click()
  await expect(page.getByLabel("Selected day weather")).toContainText("High 21°C")
  await expect(
    page.getByRole("button", { name: "Thursday 10 September", exact: true })
  ).toHaveAccessibleDescription(/1 meal planned/)
  const dialog = page.getByRole("dialog")
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  await page.screenshot({ path: "/tmp/manaaki-plan-picker-mobile.png" })
  await page.getByRole("button", { name: "Cancel", exact: true }).click()
  await page.reload({ waitUntil: "load" })
  await expect(page.getByLabel("Daily weather")).toContainText("High 21°C")
  expect(weatherRequests).toBe(1)
  await page.getByRole("button", { name: "Next week" }).click()
  await expect(page.getByLabel("Daily weather")).toHaveCount(0)
  await expect(page.getByText("Forecast not available for this date.")).toHaveCount(7)
  expect(weatherRequests).toBe(1)
})
