import { expect, test } from "@playwright/test"

test.use({ serviceWorkers: "block" })

for (const selection of ["keyboard", "pointer", "touch"] as const) {
  test.describe(selection, () => {
    if (selection === "pointer")
      test.use({
        isMobile: false,
        hasTouch: false,
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
        viewport: { width: 1280, height: 900 },
      })
    test(`keeps ingredient suggestions stable during ${selection} selection`, async ({ page }) => {
      const foods = [
        { id: "lime", name: "lime" },
        { id: "finger", name: "finger lime" },
        { id: "juice", name: "lime juice" },
      ]
      let releaseCounts = () => {}
      const countsReady = new Promise<void>(resolve => {
        releaseCounts = resolve
      })
      let requestedCounts = 0
      let returnedCounts = 0
      await page.route("**/api/foods?*", route => route.fulfill({ json: { items: foods } }))
      await page.route("**/api/recipes?*", async route => {
        const foodId = new URL(route.request().url()).searchParams.get("foods")
        if (!foodId) return route.continue()
        requestedCounts++
        await countsReady
        await route.fulfill({ json: { items: [], total: foodId === "juice" ? 20 : 1 } })
        returnedCounts++
      })
      await page.goto("/share?url=https://example.com/recipe")
      await page.getByRole("button", { name: "Import Recipe", exact: true }).click()
      await page.getByRole("button", { name: "Review parsed ingredients", exact: true }).click()
      await page.getByRole("button", { name: "Edit ingredient 1" }).click()
      const input = page.getByRole("combobox", { name: "Food" })
      await input.fill("lime")
      const options = page.getByRole("option")
      await expect(options).toHaveText(["lime", "finger lime", "lime juice"])
      const target = page.getByRole("option", { name: "finger lime", exact: true })
      if (selection === "keyboard") {
        await input.press("ArrowDown")
        await input.press("ArrowDown")
      } else if (selection === "pointer") {
        await target.hover()
        const position = await target.boundingBox()
        if (!position) throw new Error("Suggestion is not visible")
        await page.mouse.move(position.x + position.width / 2 + 4, position.y + position.height / 2)
      }
      if (selection === "keyboard") await expect(target).toHaveAttribute("data-highlighted", "")
      const background = await target.evaluate(element => getComputedStyle(element).backgroundColor)
      if (selection === "pointer") expect(background).not.toBe("rgba(0, 0, 0, 0)")
      const bounds = await target.boundingBox()
      await expect.poll(() => requestedCounts).toBe(3)
      releaseCounts()
      await expect.poll(() => returnedCounts).toBe(3)
      await expect(options).toHaveText(["lime", "finger lime", "lime juice"])
      if (selection === "keyboard") await expect(target).toHaveAttribute("data-highlighted", "")
      expect(await target.boundingBox()).toEqual(bounds)
      if (selection === "pointer") await expect(target).toHaveCSS("background-color", background)
      if (selection === "keyboard") await input.press("Enter")
      else if (selection === "touch") await target.tap()
      else await target.click()
      await expect(input).toHaveValue("finger lime")
      await input.fill("lime")
      await input.press("Escape")
      await expect(input).toHaveValue("lime")
      await expect(page.getByRole("dialog", { name: "Review parsed ingredients" })).toBeVisible()
      await page.getByLabel("Preparation / note").click()
      await input.click()
      await expect(options).toHaveText(["lime", "lime juice", "finger lime"])
    })
  })
}

test("shows prefetched popularity on the first visit and reuses it after reload", async ({
  page,
}) => {
  const foods = [
    { id: "lime", name: "lime" },
    { id: "finger", name: "finger lime" },
    { id: "juice", name: "lime juice" },
  ]
  let countRequests = 0
  await page.route("**/api/foods?*", route => route.fulfill({ json: { items: foods } }))
  await page.route("**/api/parser/ingredients", route =>
    route.fulfill({
      json: [
        {
          input: "200g spaghetti",
          confidence: { average: 1 },
          ingredient: { quantity: 1, food: foods[0] },
        },
      ],
    })
  )
  await page.route("**/api/recipes?*", async route => {
    const food = new URL(route.request().url()).searchParams.get("foods")
    if (!food) return route.continue()
    countRequests++
    await route.fulfill({ json: { items: [], total: food === "juice" ? 20 : 1 } })
  })
  for (let visit = 0; visit < 2; visit++) {
    await page.goto("/share?url=https://example.com/recipe")
    await page.getByRole("button", { name: "Import Recipe", exact: true }).click()
    await expect
      .poll(() =>
        page.evaluate(() => {
          const counts = localStorage.getItem("manaaki:ingredient-popularity:v1:fixture-user")
          return counts ? Object.keys(JSON.parse(counts)).length : 0
        })
      )
      .toBe(3)
    await page.getByRole("button", { name: "Review parsed ingredients", exact: true }).click()
    await page.getByRole("button", { name: "Edit ingredient 1" }).click()
    await page.getByRole("combobox", { name: "Food" }).click()
    await expect(page.getByRole("option")).toHaveText(["lime", "lime juice", "finger lime"])
    expect(countRequests).toBe(3)
  }
})
