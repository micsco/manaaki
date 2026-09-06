import { expect, test } from "@playwright/test"

test.afterEach(async ({ request }) => {
  await request.get("/__network?offline=false")
})

const recipeUrl = "/recipes/AAAAAAAAQACAAAAAAAAAAQ/pasta-carbonara"

test("automatically saves a recipe and restores cooking checks after an offline reload", async ({
  page,
  context,
  request,
  browserName,
}) => {
  await page.goto(recipeUrl)
  await expect(page.getByRole("heading", { name: "Pasta Carbonara", exact: true })).toBeVisible()
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller)
      await new Promise<void>(resolve =>
        navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), {
          once: true,
        })
      )
  })
  await expect
    .poll(() =>
      page.evaluate(async () => {
        for (const key of await caches.keys()) {
          if (key.startsWith("manaaki-data")) {
            const cache = await caches.open(key)
            if (await cache.match("/api/recipes/00000000-0000-4000-8000-000000000001")) return true
          }
        }
        return false
      })
    )
    .toBe(true)
  await page.getByRole("button", { name: /^cook$/i }).click()
  const ingredient = page.getByRole("button", { name: /spaghetti/i })
  await ingredient.click()
  await expect(ingredient).toHaveAttribute("aria-pressed", "true")
  await expect(page).toHaveURL(/cook=true/)
  if (browserName === "webkit") await request.get("/__network?offline=true")
  else await context.setOffline(true)
  await page.reload({ waitUntil: "load" })
  await expect(page.getByRole("button", { name: /exit cook mode/i })).toBeVisible()
  await expect(page.getByRole("button", { name: /spaghetti/i })).toHaveAttribute(
    "aria-pressed",
    "true"
  )
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  )
})

test("reopens the cached shopping list offline", async ({
  page,
  context,
  request,
  browserName,
}) => {
  await page.goto("/shopping")
  await expect(page.getByRole("button", { name: /^Spaghetti/ })).toBeVisible()
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect(page.getByRole("button", { name: /^Spaghetti/ })).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(async () => {
        for (const name of await caches.keys()) {
          if (
            name.startsWith("manaaki-data") &&
            (await (await caches.open(name)).match("/api/households/shopping/lists/list"))
          )
            return true
        }
        return false
      })
    )
    .toBe(true)
  if (browserName === "webkit") await request.get("/__network?offline=true")
  else await context.setOffline(true)
  await page.reload({ waitUntil: "load" })
  await expect(page.getByRole("button", { name: /^Spaghetti/ })).toBeVisible()
  await expect(page.getByRole("status").filter({ hasText: "You’re offline" })).toBeVisible()
  const item = page.getByRole("button", { name: /^Spaghetti/ })
  const checked = (await item.getAttribute("aria-pressed")) === "true"
  await item.click()
  await expect(item).toHaveAttribute("aria-pressed", String(!checked))
  await expect(page.getByRole("status").filter({ hasText: "saved on this device" })).toBeVisible()
  await page.reload({ waitUntil: "load" })
  await expect(page.getByRole("button", { name: /^Spaghetti/ })).toHaveAttribute(
    "aria-pressed",
    String(!checked)
  )
  if (browserName === "webkit") {
    await request.get("/__network?offline=false")
    await page.evaluate(() => window.dispatchEvent(new Event("online")))
  } else await context.setOffline(false)
  await expect(
    page.getByRole("status").filter({ hasText: "saved on this device" })
  ).not.toBeVisible()
  const serverItem = await request.get("/api/households/shopping/items/item")
  expect((await serverItem.json()).checked).toBe(!checked)
})
