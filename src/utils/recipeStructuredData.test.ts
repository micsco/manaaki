import { describe, expect, it } from "vitest"

import type { RecipeOutput } from "../api/generated/types.gen"
import { encodeRecipeId } from "./recipe"
import { buildRecipeJsonLd } from "./recipeStructuredData"

const RECIPE_ID = "23762274-fc1b-4ff4-9710-d56b1e39a742"
const ENCODED_ID = encodeRecipeId(RECIPE_ID)
const ORIGIN = "https://manaaki.micsco.nz"

describe("buildRecipeJsonLd", () => {
  it("builds a complete schema.org/Recipe object", () => {
    const recipe: RecipeOutput = {
      id: RECIPE_ID,
      name: "Swedish Meatballs",
      slug: "swedish-meatballs",
      description: "Juicy meatballs in creamy gravy.",
      image: "CJ2t",
      recipeServings: 4,
      recipeYield: "plates",
      prepTimeSeconds: 1200,
      performTimeSeconds: 1800,
      totalTimeSeconds: 3000,
      dateAdded: "2026-05-02",
      updatedAt: "2026-05-03T10:00:00Z",
      orgURL: "https://www.recipetineats.com/swedish-meatballs/",
      recipeCategory: [{ name: "Mains", slug: "mains" }],
      tags: [
        { name: "Dinner", slug: "dinner" },
        { name: "Beef", slug: "beef" },
        { name: "Dinner", slug: "dinner" },
      ],
      recipeIngredient: [
        { title: "Meatballs", display: "Meatballs" },
        {
          quantity: 500,
          unit: { name: "gram", abbreviation: "g", useAbbreviation: true },
          food: { name: "beef mince" },
          note: "lean",
        },
        { display: "1 onion, grated" },
      ],
      recipeInstructions: [
        { summary: "Mix", text: "Combine meat and onion." },
        { text: "Bake for 20 minutes." },
      ],
      settings: { showNutrition: true },
      nutrition: {
        calories: "450.4",
        proteinContent: "32",
        carbohydrateContent: "18.5",
        fatContent: "24",
        saturatedFatContent: "9",
        fiberContent: "2.2",
        sugarContent: "3",
        sodiumContent: "620",
      },
    }

    const jsonLd = buildRecipeJsonLd(recipe, ORIGIN)

    expect(jsonLd).toEqual({
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: "Swedish Meatballs",
      url: `${ORIGIN}/recipes/${ENCODED_ID}/swedish-meatballs`,
      description: "Juicy meatballs in creamy gravy.",
      image: [`${ORIGIN}/api/media/recipes/${RECIPE_ID}/images/original.webp?v=CJ2t`],
      datePublished: "2026-05-02",
      dateModified: "2026-05-03T10:00:00Z",
      prepTime: "PT20M",
      cookTime: "PT30M",
      totalTime: "PT50M",
      recipeYield: "4 plates",
      recipeCategory: "Mains",
      keywords: "Dinner, Beef",
      recipeIngredient: ["500 g beef mince lean", "1 onion, grated"],
      recipeInstructions: [
        { "@type": "HowToStep", name: "Mix", text: "Combine meat and onion." },
        { "@type": "HowToStep", text: "Bake for 20 minutes." },
      ],
      nutrition: {
        "@type": "NutritionInformation",
        calories: "450 calories",
        proteinContent: "32 g",
        carbohydrateContent: "18.5 g",
        fatContent: "24 g",
        saturatedFatContent: "9 g",
        fiberContent: "2.2 g",
        sugarContent: "3 g",
        sodiumContent: "620 mg",
      },
      isBasedOn: "https://www.recipetineats.com/swedish-meatballs/",
    })
  })

  it("groups titled instructions into HowToSection entries", () => {
    const recipe: RecipeOutput = {
      name: "Layered Pasta",
      recipeInstructions: [
        { title: "Sauce", text: "Simmer tomatoes." },
        { text: "Blend until smooth." },
        { title: "Bake", text: "Bake at 190C for 25 minutes." },
      ],
    }

    const jsonLd = buildRecipeJsonLd(recipe, ORIGIN)

    expect(jsonLd.recipeInstructions).toEqual([
      {
        "@type": "HowToSection",
        name: "Sauce",
        itemListElement: [
          { "@type": "HowToStep", text: "Simmer tomatoes." },
          { "@type": "HowToStep", text: "Blend until smooth." },
        ],
      },
      {
        "@type": "HowToSection",
        name: "Bake",
        itemListElement: [{ "@type": "HowToStep", text: "Bake at 190C for 25 minutes." }],
      },
    ])
  })

  it("omits nutrition when showNutrition is disabled and ignores unsafe orgURL schemes", () => {
    const recipe: RecipeOutput = {
      name: "Simple Toast",
      prepTime: "1 hour 5 minutes",
      recipeServings: 2,
      recipeCategory: [
        { name: "Breakfast", slug: "breakfast" },
        { name: "Quick", slug: "quick" },
      ],
      orgURL: "javascript:alert(1)",
      settings: { showNutrition: false },
      nutrition: { calories: "200" },
    }

    const jsonLd = buildRecipeJsonLd(recipe, ORIGIN)

    expect(jsonLd.prepTime).toBe("PT1H5M")
    expect(jsonLd.recipeYield).toBe("2 servings")
    expect(jsonLd.recipeCategory).toEqual(["Breakfast", "Quick"])
    expect(jsonLd.nutrition).toBeUndefined()
    expect(jsonLd.isBasedOn).toBeUndefined()
  })
})
