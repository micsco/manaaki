import process from "node:process"

import { expect, test } from "@playwright/test"

test("loads editing controls on demand and skips the shake collection without permission", async ({
  page,
}) => {
  test.skip(!!process.env.PERF_BASE_URL, "Fixture-only interaction check")
  await page.addInitScript(() =>
    Object.defineProperty(window, "DeviceMotionEvent", { value: undefined })
  )
  const requests: string[] = []
  page.on("request", request => requests.push(new URL(request.url()).pathname))
  await page.goto("/plan")
  await expect(page.getByRole("link", { name: /dinner pasta carbonara/i })).toBeVisible()
  expect(requests).not.toContain("/api/recipes")
  expect(
    requests.some(path =>
      /(?:MealPlanDialog|BuildShoppingListDialog|ImportRecipeModal|AboutModal|jetbrains)/.test(path)
    )
  ).toBe(false)
  let release!: () => void
  const pending = new Promise<void>(resolve => {
    release = resolve
  })
  await page.route("**/assets/MealPlanDialog-*.js", async route => {
    await pending
    await route.continue()
  })
  await page.getByRole("button", { name: "Adjust plan for Pasta Carbonara" }).click()
  await expect(page.getByRole("dialog", { name: "Loading…" })).toBeVisible()
  await page.getByRole("button", { name: "Cancel", exact: true }).click()
  await expect(page.getByRole("dialog")).not.toBeVisible()
  release()
  await page.getByRole("button", { name: "Adjust plan for Pasta Carbonara" }).click()
  await expect(page.getByRole("dialog", { name: "Edit planned meal" })).toBeVisible()
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: "Build shopping list", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Build shopping list" })).toBeVisible()
  expect(requests.some(path => /BuildShoppingListDialog.*\.js$/.test(path))).toBe(true)
})
