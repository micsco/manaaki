import { expect, test } from "@playwright/test"

const RECIPE_1_ID = "00000000-0000-4000-8000-000000000001"
const RECIPE_1_ENCODED = "AAAAAAAAQACAAAAAAAAAAQ"
const RECIPE_1_SLUG = "pasta-carbonara"
const RECIPE_1_URL = `/recipes/${RECIPE_1_ENCODED}/${RECIPE_1_SLUG}`

const RECIPE_2_ID = "00000000-0000-4000-8000-000000000002"
const RECIPE_2_SLUG = "risotto"

const mockRecipeList = {
  items: [
    {
      id: RECIPE_1_ID,
      slug: RECIPE_1_SLUG,
      name: "Pasta Carbonara",
      description: "A classic Roman pasta dish",
      totalTime: "PT30M",
      rating: 4.5,
      image: null,
    },
    {
      id: RECIPE_2_ID,
      slug: RECIPE_2_SLUG,
      name: "Mushroom Risotto",
      description: null,
      totalTime: "PT45M",
      rating: null,
      image: null,
    },
  ],
  total: 2,
  page: 1,
  per_page: 50,
}

const mockRecipeDetail = {
  id: RECIPE_1_ID,
  slug: RECIPE_1_SLUG,
  name: "Pasta Carbonara",
  description: "A classic Roman pasta dish",
  totalTime: "PT30M",
  prepTime: "PT10M",
  cookTime: "PT20M",
  rating: 4.5,
  recipeYield: "4 servings",
  image: null,
  recipeCategory: [{ name: "Dinner" }],
  tags: [{ name: "Italian" }],
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
    {
      id: "step-1",
      text: "Cook the spaghetti in salted boiling water.",
      title: null,
    },
    {
      id: "step-2",
      text: "Mix egg yolks with pecorino.",
      title: null,
    },
  ],
  notes: [],
  nutrition: null,
}

test.describe("Recipe list", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("/api/recipes*", route =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockRecipeList),
      })
    )
  })

  test("shows the page heading", async ({ page }) => {
    await page.goto("/recipes")
    await expect(page.getByRole("heading", { name: /^manaaki$/i })).toBeVisible()
  })

  test("shows recipe names from the API", async ({ page }) => {
    await page.goto("/recipes")
    await expect(page.getByRole("heading", { name: /pasta carbonara/i })).toBeVisible()
    await expect(page.getByRole("heading", { name: /mushroom risotto/i })).toBeVisible()
  })

  for (const width of [390, 1280]) {
    test(`calorie badge explains the count without navigating at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 })
      await page.route(`/api/recipes/${RECIPE_1_ID}`, route =>
        route.fulfill({
          json: {
            ...mockRecipeDetail,
            nutrition: { calories: "450" },
            settings: { showNutrition: true },
          },
        })
      )
      await page.route(`/api/recipes/${RECIPE_2_ID}`, route =>
        route.fulfill({ json: { nutrition: null } })
      )
      await page.goto("/recipes")
      const badge = page.getByRole("button", { name: "450 calories per serving" })
      await expect(badge).toHaveText("450")
      const time = page.getByText("PT30M", { exact: true })
      await expect(time).toBeVisible()
      const badgeBox = await badge.boundingBox()
      const timeBox = await time.boundingBox()
      expect(badgeBox!.x).toBeGreaterThan(timeBox!.x)
      expect(Math.abs(badgeBox!.y - timeBox!.y)).toBeLessThan(4)
      await badge.click()
      await expect(page.getByRole("dialog")).toHaveText("450 calories per serving")
      await expect(page).toHaveURL(/\/recipes$/)
      await page.keyboard.press("Escape")
      await expect(page.getByRole("dialog")).not.toBeVisible()
      await page.getByRole("link", { name: /pasta carbonara/i }).click()
      await expect(page).toHaveURL(new RegExp(RECIPE_1_ENCODED))
    })
  }

  test("shows recipe count", async ({ page }) => {
    await page.goto("/recipes")
    await expect(page.getByText(/2 recipes/i)).toBeVisible()
  })

  test("clicking a recipe navigates to its detail page", async ({ page }) => {
    await page.route(`/api/recipes/${RECIPE_1_ID}`, route =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockRecipeDetail),
      })
    )

    await page.goto("/recipes")
    await page.getByRole("link", { name: /pasta carbonara/i }).click()

    await expect(page).toHaveURL(new RegExp(RECIPE_1_ENCODED))
  })
})

test.describe("Recipe detail", () => {
  for (const width of [320, 390, 480, 1280]) {
    test(`keeps the recipe toolbar on one row at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 })
      await page.route("/api/auth/me", route =>
        route.fulfill({
          json: { user: { id: "fixture-user", fullName: "Fixture Cook" }, isAnonymous: false },
        })
      )
      await page.route("/api/recipes?*", route => route.fulfill({ json: mockRecipeList }))
      await page.goto(RECIPE_1_URL)
      const back = page.getByRole("link", { name: "All recipes", exact: true })
      const controls = [
        back,
        page.getByRole("button", { name: "Recipe actions", exact: true }),
        page.getByRole("button", { name: "Copy recipe link", exact: true }),
        page.getByRole("link", { name: "Previous recipe", exact: true }),
        page.getByRole("link", { name: "Next recipe", exact: true }),
      ]
      for (const control of controls) await expect(control).toBeVisible()
      await page.evaluate(() => document.fonts.ready)
      const backBox = (await back.boundingBox())!
      let previousRight = 0
      for (const control of controls) {
        const box = (await control.boundingBox())!
        expect(Math.abs(box.y - backBox.y)).toBeLessThan(1)
        expect(box.width).toBeGreaterThanOrEqual(44)
        expect(box.height).toBeGreaterThanOrEqual(44)
        expect(box.x).toBeGreaterThanOrEqual(previousRight)
        expect(box.x + box.width).toBeLessThanOrEqual(width)
        previousRight = box.x + box.width
      }
    })
  }

  test.beforeEach(async ({ page }) => {
    await page.route(`/api/recipes/${RECIPE_1_ID}`, route =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockRecipeDetail),
      })
    )
  })

  test("shows the recipe name", async ({ page }) => {
    await page.goto(RECIPE_1_URL)
    await expect(page.getByRole("heading", { name: /pasta carbonara/i })).toBeVisible()
  })

  test("shows the Ingredients section", async ({ page }) => {
    await page.goto(RECIPE_1_URL)
    await expect(page.getByRole("heading", { name: /ingredients/i })).toBeVisible()
  })

  test("shows the Instructions section", async ({ page }) => {
    await page.goto(RECIPE_1_URL)
    await expect(page.getByRole("heading", { name: /method/i })).toBeVisible()
  })

  test("shows ingredient checkboxes", async ({ page }) => {
    await page.goto(RECIPE_1_URL)
    const buttons = page.getByRole("button", { name: /spaghetti|egg yolks/i })
    await expect(buttons).toHaveCount(2)
  })

  test("shows a back link to all recipes", async ({ page }) => {
    await page.goto(RECIPE_1_URL)
    await expect(page.getByRole("link", { name: /all recipes/i })).toBeVisible()
  })
})
