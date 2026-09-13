import { expect, test } from "@playwright/test"

for (const width of [320, 390]) {
  test(`update button gives feedback and contains its focus outline at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.route("/api/**", route =>
      route.fulfill({
        json: route.request().url().endsWith("/auth/me")
          ? { user: null, isAnonymous: true }
          : { items: [], total: 0, total_pages: 1 },
      })
    )
    await page.goto("/recipes")
    await expect(page.getByRole("link", { name: "Manaaki home" })).toBeVisible()
    await page.getByRole("button", { name: "Filters", exact: true }).click()
    await page.getByRole("button", { name: "Close filters" }).click()
    await page.evaluate(() => {
      navigator.serviceWorker.getRegistration = () => new Promise(() => {})
      window.dispatchEvent(new Event("pwa-update-ready"))
    })
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
    await button.click({ trial: true })
    const bounds = (await button.boundingBox())!
    expect(bounds.height).toBeGreaterThanOrEqual(44)
    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
    const background = await button.evaluate(element => getComputedStyle(element).backgroundColor)
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
    await page.mouse.down()
    await expect(button).toHaveCSS("background-color", "rgb(154, 52, 18)")
    expect(background).not.toBe("rgb(154, 52, 18)")
    await page.mouse.up()
    await expect(page.getByRole("button", { name: "Updating…" })).toBeDisabled()
    await expect(page.getByText("Updating app…")).toBeVisible()
  })
}
