import { expect, test } from "@playwright/test"

test("keeps filters reachable on a small phone and provides installation guidance", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await page.goto("/recipes")
  await expect(page.getByRole("heading", { name: "Pasta Carbonara" })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  expect(await page.evaluate(() => document.fonts.check('16px "Inter Variable"'))).toBe(true)
  await page.getByRole("button", { name: /^Filters/ }).click()
  const close = page.getByRole("button", { name: "Close filters" })
  const target = await close.boundingBox()
  expect(target?.width).toBeGreaterThanOrEqual(44)
  expect(target?.height).toBeGreaterThanOrEqual(44)
  await expect(page.getByRole("button", { name: "Show results" })).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath("mobile-filters.png") })
  await close.click()
  await page.getByRole("button", { name: /User menu/ }).click()
  await page.getByRole("menuitem", { name: "About Manaaki" }).click()
  await expect(page.getByRole("region", { name: "Install Manaaki" })).toBeVisible()
  const about = page.getByRole("dialog", { name: "About Manaaki" })
  const bounds = await about.boundingBox()
  expect(bounds!.x).toBeGreaterThanOrEqual(15)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(305)
  await page.screenshot({ path: info.outputPath("mobile-installation.png") })
})

test("keeps dialogs scrollable in a short landscape viewport and respects reduced motion", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/shopping")
  const input = page.getByRole("textbox", { name: "Add an item" })
  await expect(input).toBeVisible()
  expect(
    await input.evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize))
  ).toBeGreaterThanOrEqual(16)
  await input.fill("Milk")
  await page.getByRole("button", { name: "Build shopping list", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Build shopping list" })
  await expect(dialog).toBeVisible()
  expect((await dialog.boundingBox())!.height).toBeLessThanOrEqual(390)
  await page.screenshot({ path: info.outputPath("landscape-shopping.png") })
  await page.keyboard.press("Escape")
  await expect(dialog).not.toBeVisible()
})
