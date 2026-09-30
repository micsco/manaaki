import { expect, test, type Page } from "@playwright/test"

test.use({ serviceWorkers: "block" })

const recipes = ["Soup", "Curry", "Pie"].map((name, i) => ({
  id: `00000000-0000-4000-8000-00000000000${i + 1}`,
  slug: name.toLowerCase(),
  name,
  image: "1",
  recipeIngredient: [],
  recipeInstructions: [],
  recipeCategory: [],
  tags: [],
}))

async function openRecipe(page: Page, name: string) {
  const errors: string[] = []
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text())
  })
  page.on("pageerror", error => errors.push(error.message))
  await page.addInitScript(() => {
    const transitions: (string[] | null)[] = []
    Object.assign(window, { recordedTransitions: transitions })
    const start = document.startViewTransition?.bind(document)
    if (!start) return
    document.startViewTransition = ((
      update?: ViewTransitionUpdateCallback | StartViewTransitionOptions
    ) => {
      transitions.push(typeof update === "object" && update?.types ? [...update.types] : null)
      return start(update)
    }) as typeof document.startViewTransition
  })
  await page.route("**/api/recipes?*", route =>
    route.fulfill({ json: { items: recipes, total_pages: 1 } })
  )
  for (const recipe of recipes)
    await page.route(`**/api/recipes/${recipe.id}`, route => route.fulfill({ json: recipe }))
  await page.goto("/recipes", { waitUntil: "load" })
  await page.getByRole("link", { name }).first().click()
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible()
  await expect(page.getByRole("link", { name: "Next recipe" })).toBeVisible()
  return errors
}

async function waitForTransitionEnd(page: Page) {
  await page.waitForFunction(() => !document.documentElement.matches(":active-view-transition"))
}

async function captureMidTransition(page: Page, path: string) {
  await page.waitForFunction(() => document.documentElement.matches(":active-view-transition"))
  await page.waitForTimeout(1000)
  await page.screenshot({ path })
  await waitForTransitionEnd(page)
}

function recordedTransitions(page: Page) {
  return page.evaluate(
    () => (window as unknown as { recordedTransitions: (string[] | null)[] }).recordedTransitions
  )
}

test("slides between recipes in the direction of travel", async ({ page, browserName }, info) => {
  const errors = await openRecipe(page, "Curry")
  const slowAnimations = browserName === "chromium"
  if (slowAnimations) {
    const session = await page.context().newCDPSession(page)
    await session.send("Animation.enable")
    await session.send("Animation.setPlaybackRate", { playbackRate: 0.1 })
  }

  await page.getByRole("link", { name: "Next recipe" }).click()
  if (slowAnimations) await captureMidTransition(page, info.outputPath("recipe-next.png"))
  await expect(page.getByRole("heading", { name: "Pie", level: 1 })).toBeVisible()
  await waitForTransitionEnd(page)

  await page.keyboard.press("ArrowLeft")
  if (slowAnimations) await captureMidTransition(page, info.outputPath("recipe-prev.png"))
  await expect(page.getByRole("heading", { name: "Curry", level: 1 })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Pie", level: 1 })).toHaveCount(0)

  if (await page.evaluate(() => "startViewTransition" in document))
    expect(await recordedTransitions(page)).toEqual([["recipe-next"], ["recipe-prev"]])
  expect(errors).toEqual([])
})

test("does not animate history navigation or cook mode", async ({ page }) => {
  const errors = await openRecipe(page, "Soup")
  await page.getByRole("link", { name: "Next recipe" }).click()
  await expect(page.getByRole("heading", { name: "Curry", level: 1 })).toBeVisible()
  const afterClick = (await recordedTransitions(page)).length

  await page.goBack()
  await expect(page.getByRole("heading", { name: "Soup", level: 1 })).toBeVisible()
  await page.getByRole("button", { name: "Cook", exact: true }).click()
  await expect(page).toHaveURL(/cook=true/)
  await page.keyboard.press("ArrowRight")
  await expect(page.getByRole("heading", { name: "Soup", level: 1 })).toBeVisible()

  expect((await recordedTransitions(page)).slice(afterClick).filter(Boolean)).toEqual([])
  expect(errors).toEqual([])
})

test("skips the slide when reduced motion is preferred", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  const errors = await openRecipe(page, "Pie")
  await page.keyboard.press("ArrowRight")
  await expect(page.getByRole("heading", { name: "Soup", level: 1 })).toBeVisible()
  expect((await recordedTransitions(page)).filter(Boolean)).toEqual([])
  expect(errors).toEqual([])
})

test("keeps keyboard hints off touch-only phones", async ({ page }) => {
  const errors = await openRecipe(page, "Soup")
  const hasFinePointer = await page.evaluate(() => matchMedia("(any-pointer: fine)").matches)
  const hint = page.getByTestId("recipe-nav-hotkey-hint")
  if (hasFinePointer) await expect(hint).toBeVisible()
  else await expect(hint).toBeHidden()
  expect(errors).toEqual([])
})
