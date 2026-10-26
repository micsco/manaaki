import { expect, type Page, test } from "@playwright/test"

const recipeUrl = "/recipes/AAAAAAAAQACAAAAAAAAAAQ/pasta-carbonara"

async function waitForControl(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller)
      await new Promise<void>(resolve =>
        navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), {
          once: true,
        })
      )
  })
}

async function publishRelease(page: Page) {
  await page.request.get("/__release")
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration()
    await registration?.update()
    await new Promise<void>(resolve => {
      const check = () => (registration?.waiting ? resolve() : setTimeout(check, 50))
      check()
    })
  })
}

test("applies a new release on the next page change without asking", async ({ page }) => {
  await page.goto("/recipes")
  await waitForControl(page)
  await page.evaluate(() => {
    Object.assign(window, { stillOldPage: true })
  })
  await page.evaluate(() => window.dispatchEvent(new Event("pointerdown")))
  await publishRelease(page)

  await expect(page.getByRole("button", { name: "Update", exact: true })).toHaveCount(0)
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Shopping" })
    .click()

  await expect(page).toHaveURL(/\/shopping/)
  await expect
    .poll(() => page.evaluate(() => "stillOldPage" in window).catch(() => true))
    .toBe(false)
  await waitForControl(page)
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration()
        return {
          waiting: !!registration?.waiting,
          controlled: !!navigator.serviceWorker.controller,
        }
      })
    )
    .toEqual({ waiting: false, controlled: true })
})

test("keeps cooking undisturbed and only asks after a long hold", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await page.clock.install()
  await page.goto(recipeUrl)
  await waitForControl(page)
  await page.getByRole("button", { name: /^cook$/i }).click()
  await page.evaluate(() => {
    Object.assign(window, { stillOldPage: true })
  })
  await publishRelease(page)

  await page.clock.fastForward("30:00")
  expect(await page.evaluate(() => "stillOldPage" in window)).toBe(true)
  await expect(page.getByRole("button", { name: "Update", exact: true })).toHaveCount(0)

  await page.clock.fastForward("12:00:00")
  const button = page.getByRole("button", { name: "Update", exact: true })
  await expect(button).toBeVisible()
  await page.keyboard.press("Tab")
  await button.focus()
  const outline = await button.evaluate(element => {
    const style = getComputedStyle(element)
    return { width: parseFloat(style.outlineWidth), offset: parseFloat(style.outlineOffset) }
  })
  expect(outline.width).toBeGreaterThan(0)
  expect(outline.offset + outline.width).toBeLessThanOrEqual(0)
  const bounds = (await button.boundingBox())!
  const width = page.viewportSize()!.width
  expect(bounds.height).toBeGreaterThanOrEqual(44)
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
  await button.click()
  await expect
    .poll(() => page.evaluate(() => "stillOldPage" in window).catch(() => true))
    .toBe(false)
  await expect(page).toHaveURL(/cook=true/)
})

for (const path of ["/recipes", "/plan", "/shopping", recipeUrl]) {
  test(`applies a new release in place after ten quiet minutes on ${path}`, async ({ page }) => {
    await page.clock.install()
    await page.goto(path)
    await waitForControl(page)
    await page.evaluate(() => {
      Object.assign(window, { stillOldPage: true })
      window.dispatchEvent(new Event("pointerdown"))
    })
    await publishRelease(page)
    await page.clock.fastForward("09:00")
    expect(await page.evaluate(() => "stillOldPage" in window)).toBe(true)
    await page.clock.fastForward("02:00")
    await expect
      .poll(() => page.evaluate(() => "stillOldPage" in window).catch(() => true))
      .toBe(false)
    expect(new URL(page.url()).pathname).toBe(path)
  })
}
