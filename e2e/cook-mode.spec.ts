import { expect, test } from "@playwright/test"

const mockRecipeDetail = {
  id: "recipe-1",
  slug: "pasta-carbonara",
  name: "Pasta Carbonara",
  description: "A classic Roman pasta dish",
  totalTime: "PT30M",
  prepTime: "PT10M",
  cookTime: "PT20M",
  rating: 4.5,
  recipeYield: "4 servings",
  image: null,
  recipeCategory: [],
  tags: [],
  recipeIngredient: [
    {
      referenceId: "ing-1",
      display: "200g spaghetti",
      originalText: "200g spaghetti",
      quantity: 200,
      food: { name: "spaghetti" },
      unit: { name: "g", abbreviation: "g", useAbbreviation: true },
      note: null,
      title: null,
      isFood: true,
      disableAmount: false,
    },
    {
      referenceId: "ing-2",
      display: "3 egg yolks",
      originalText: "3 egg yolks",
      quantity: 3,
      food: { name: "egg yolks" },
      unit: null,
      note: null,
      title: null,
      isFood: true,
      disableAmount: false,
    },
  ],
  recipeInstructions: [
    { id: "step-1", text: "Cook the spaghetti in salted boiling water.", title: null },
    { id: "step-2", text: "Mix egg yolks with pecorino.", title: null },
  ],
  notes: [],
  nutrition: null,
}

test.describe("Cook Mode", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("/api/recipes/pasta-carbonara", route =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockRecipeDetail),
      })
    )
    await page.goto("/recipes/pasta-carbonara")
  })

  test("shows the Cook Mode toggle button", async ({ page }) => {
    await expect(page.getByRole("button", { name: /cook mode/i })).toBeVisible()
  })

  test("recipe header is visible before entering cook mode", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /pasta carbonara/i })).toBeVisible()
  })

  test("entering cook mode hides the recipe header", async ({ page }) => {
    await page.getByRole("button", { name: /cook mode/i }).click()

    await expect(page.getByRole("button", { name: /exit cook mode/i })).toBeVisible()
  })

  test("ingredient checkboxes are visible in cook mode", async ({ page }) => {
    await page.getByRole("button", { name: /cook mode/i }).click()

    const checkboxes = page.getByRole("checkbox")
    await expect(checkboxes).toHaveCount(2)
  })

  test("checking an ingredient persists across the session", async ({ page }) => {
    const firstCheckbox = page.getByRole("checkbox").first()
    await firstCheckbox.check()

    await expect(firstCheckbox).toBeChecked()

    await page.reload()
    await expect(page.getByRole("checkbox").first()).toBeChecked()
  })

  test("exiting cook mode restores the toggle label", async ({ page }) => {
    await page.getByRole("button", { name: /cook mode/i }).click()
    await page.getByRole("button", { name: /exit cook mode/i }).click()

    await expect(page.getByRole("button", { name: /^cook mode$/i })).toBeVisible()
  })

  test("cook mode state is reflected in the URL", async ({ page }) => {
    await page.getByRole("button", { name: /cook mode/i }).click()

    await expect(page).toHaveURL(/[?&]cook=true/)
  })

  test("navigating directly to ?cook=true URL starts in cook mode", async ({ page }) => {
    await page.goto("/recipes/pasta-carbonara?cook=true")

    await expect(page.getByRole("button", { name: /exit cook mode/i })).toBeVisible()
  })
})
