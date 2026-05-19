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

  test("shows recipe count", async ({ page }) => {
    await page.goto("/recipes")
    await expect(page.getByText(/2 recipes/i)).toBeVisible()
  })

  test("clicking a recipe navigates to its detail page", async ({ page }) => {
    await page.route(`/api/recipes/${RECIPE_1_ID}`, route =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockRecipeDetail) })
    )

    await page.goto("/recipes")
    await page.getByRole("link", { name: /pasta carbonara/i }).click()

    await expect(page).toHaveURL(new RegExp(RECIPE_1_ENCODED))
  })
})

test.describe("Recipe detail", () => {
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
