import { expect, test } from "@playwright/test"

const recipeId = "00000000-0000-4000-8000-000000000001"

test.afterEach(async ({ request }) => {
  await request.patch(`/api/recipes/${recipeId}`, { data: { name: "Pasta Carbonara" } })
})

test("refreshes the plan manually and automatically while preserving the chosen date", async ({
  page,
  request,
}) => {
  await page.clock.install()
  await page.goto("/plan?date=2026-09-19")
  await expect(page.getByRole("link", { name: /Pasta Carbonara/ }).first()).toBeVisible()
  await request.patch(`/api/recipes/${recipeId}`, { data: { name: "Updated dinner" } })
  await page.getByRole("button", { name: "Refresh data", exact: true }).click()
  await expect(page.getByRole("link", { name: /Updated dinner/ }).first()).toBeVisible()
  await expect(page.getByRole("button", { name: "Refresh data", exact: true })).toBeEnabled()
  await expect(page).toHaveURL(/date=2026-09-19/)
  await request.patch(`/api/recipes/${recipeId}`, { data: { name: "Dinner changed elsewhere" } })
  await page.clock.fastForward(61_000)
  await expect(page.getByRole("link", { name: /Dinner changed elsewhere/ }).first()).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  )
})
