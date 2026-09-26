import { expect, test } from "@playwright/test"

test.use({ serviceWorkers: "block" })

const recipes = ["Soup", "Old favourite", "Autumn curry"].map((name, i) => ({
  id: `00000000-0000-4000-8000-00000000000${i + 1}`,
  slug: name.toLowerCase().replaceAll(" ", "-"),
  name,
  recipeIngredient: [],
  recipeInstructions: [],
  recipeCategory: [],
  tags: [],
}))

function cookingHistory() {
  const now = new Date()
  const dates = [
    [1, 5],
    [700, 710, 720],
    [360, 370],
  ]
  return recipes.flatMap((recipe, index) =>
    dates[index].map(daysAgo => {
      const date = new Date(now)
      date.setDate(date.getDate() - daysAgo)
      return {
        id: `${index}-${daysAgo}`,
        recipeId: recipe.id,
        householdId: "home",
        userId: "user",
        groupId: "group",
        subject: "Mike made this for dinner",
        eventType: "info",
        timestamp: date.toISOString(),
      }
    })
  )
}

test("shows household rows, keeps them out of search, and opens a recipe", async ({ page }) => {
  let historyRequests = 0
  await page.route("**/api/auth/me", route =>
    route.fulfill({
      json: { user: { id: "user", householdId: "home", fullName: "Mike" }, isAnonymous: false },
    })
  )
  await page.route("**/api/recipes?*", route =>
    route.fulfill({ json: { items: recipes, total_pages: 1 } })
  )
  await page.route("**/api/recipes/timeline/events?*", route => {
    historyRequests++
    return route.fulfill({ json: { items: cookingHistory(), total_pages: 1 } })
  })
  await page.route("**/api/households/mealplans?*", route =>
    route.fulfill({
      json: {
        items: [
          {
            recipeId: recipes[0].id,
            date: new URL(route.request().url()).searchParams.get("start_date"),
          },
        ],
        total_pages: 1,
      },
    })
  )
  await page.goto("/recipes", { waitUntil: "load" })
  const recent = page.getByRole("list", { name: "Recently popular" })
  await expect(recent.getByRole("link", { name: "Soup" })).toBeVisible()
  await expect(
    page
      .getByRole("list", { name: "Forgotten favourites" })
      .getByRole("link", { name: "Old favourite" })
  ).toBeVisible()
  await expect(
    page
      .getByRole("list", { name: "This time last year" })
      .getByRole("link", { name: "Autumn curry" })
  ).toBeVisible()
  await expect(page.getByText("On your plan in the next two weeks")).toBeVisible()
  await page.screenshot({ path: test.info().outputPath("recipe-discovery.png"), fullPage: true })
  const search = page.getByRole("searchbox", { name: /search recipes/i })
  await search.fill("Soup")
  await expect(recent).toBeHidden()
  await expect(page.getByRole("heading", { name: "Soup", exact: true })).toHaveCount(1)
  await search.fill("")
  await expect(recent).toBeVisible()
  expect(historyRequests).toBe(1)
  await recent.getByRole("link", { name: "Soup" }).click()
  await expect(page).toHaveURL(/\/recipes\/AAAAAAAAQACAAAAAAAAAAQ\/soup/)
})

test("does not load cooking history for visitors", async ({ page }) => {
  let historyRequests = 0
  await page.route("**/api/auth/me", route =>
    route.fulfill({ json: { user: null, isAnonymous: true } })
  )
  await page.route("**/api/recipes?*", route =>
    route.fulfill({ json: { items: recipes, total_pages: 1 } })
  )
  await page.route("**/api/recipes/timeline/events?*", route => {
    historyRequests++
    return route.fulfill({ json: { items: [] } })
  })
  await page.goto("/recipes", { waitUntil: "load" })
  await expect(page.getByRole("heading", { name: "Soup", exact: true })).toBeVisible()
  await expect(page.getByRole("list", { name: "Recently popular" })).toHaveCount(0)
  expect(historyRequests).toBe(0)
})
