import { expect, test } from "@playwright/test"

test("opens a shared social link, survives reload, and imports only after review", async ({
  page,
}) => {
  const sharedUrl = "https://www.youtube.com/shorts/dinner?si=abc&feature=share"
  const imports: string[] = []
  const parsers: string[] = []
  const updates: unknown[] = []
  page.on("request", request => {
    if (request.method() === "PATCH" && request.url().includes("/api/recipes/"))
      updates.push(request.postDataJSON())
    if (request.url().endsWith("/api/parser/ingredients") && request.method() === "POST")
      parsers.push(request.postDataJSON().parser)
    if (request.url().endsWith("/api/recipes/create/url") && request.method() === "POST") {
      imports.push(request.postDataJSON().url)
    }
  })
  await page.goto(`/share?${new URLSearchParams({ text: `Try this recipe! ${sharedUrl}` })}`)
  await expect(page.getByLabel("Recipe URL")).toHaveValue(sharedUrl)
  expect(imports).toEqual([])
  await page.reload()
  await expect(page.getByLabel("Recipe URL")).toHaveValue(sharedUrl)
  await page.getByRole("button", { name: "Import Recipe", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Pasta Carbonara", exact: true })).toBeVisible()
  expect(imports).toEqual([sharedUrl])
  expect(parsers).toEqual(["openai"])
  expect(updates).toEqual([])
  await page.getByRole("button", { name: "Review parsed ingredients", exact: true }).click()
  await expect(page.getByText("Original: 200g spaghetti")).toBeVisible()
  await expect(page.getByRole("button", { name: "Save reviewed ingredients" })).toBeDisabled()
  await page.getByRole("button", { name: "Cancel", exact: true }).click()
  expect(updates).toEqual([])
  await page.getByRole("button", { name: "Review parsed ingredients", exact: true }).click()
  await page.getByLabel("I’ve checked this ingredient").check()
  await page.screenshot({
    path: `/tmp/manaaki-ingredient-review-${page.context().browser()?.browserType().name()}.png`,
  })
  await page.getByRole("button", { name: "Save reviewed ingredients" }).click()
  await expect(page.getByRole("dialog", { name: "Review parsed ingredients" })).not.toBeVisible()
  await expect(page.getByRole("button", { name: "Review parsed ingredients" })).not.toBeVisible()
  expect(updates).toEqual([
    expect.objectContaining({
      recipeIngredient: [
        expect.objectContaining({ quantity: 200, referenceId: "fixture-ingredient" }),
      ],
    }),
  ])
  expect(parsers).toEqual(["openai"])
})

test("handles missing links and a second share without stale input", async ({ page }) => {
  await page.goto("/share?text=Dinner")
  await expect(page.getByText(/did not include a web link/)).toBeVisible()
  await page.getByRole("button", { name: "Cancel", exact: true }).click()
  await expect(page).toHaveURL(/\/recipes$/)
  await page.goto(
    `/share?${new URLSearchParams({ text: "https://www.instagram.com/reel/dinner/" })}`
  )
  await expect(page.getByLabel("Recipe URL")).toHaveValue("https://www.instagram.com/reel/dinner/")
})

test("opens an incoming share offline without losing its URL", async ({
  page,
  context,
  request,
  browserName,
}) => {
  try {
    await page.goto("/recipes")
    await expect(page.getByRole("heading", { name: "Pasta Carbonara" })).toBeVisible()
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
      if (!navigator.serviceWorker.controller)
        await new Promise<void>(resolve =>
          navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), {
            once: true,
          })
        )
    })
    await page.reload()
    await expect(page.getByRole("heading", { name: "Pasta Carbonara" })).toBeVisible()
    if (browserName === "webkit") await request.get("/__network?offline=true")
    else await context.setOffline(true)
    const url = "https://example.com/dinner?servings=4"
    await page.goto(`/share?${new URLSearchParams({ url })}`)
    await expect(page.getByLabel("Recipe URL")).toHaveValue(url)
    await expect(page.getByRole("button", { name: "Import Recipe", exact: true })).toBeDisabled()
    if (browserName === "webkit") await request.get("/__network?offline=false")
    else await context.setOffline(false)
    await page.reload()
    await expect(page.getByLabel("Recipe URL")).toHaveValue(url)
    await expect(page.getByRole("button", { name: "Import Recipe", exact: true })).toBeEnabled()
  } finally {
    await request.get("/__network?offline=false")
    await context.setOffline(false)
  }
})
