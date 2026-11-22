import { describe, expect, it } from "vitest"

import type { RecipeOutput, RecipeSummary } from "../api/generated/types.gen"
import { encodeRecipeId } from "./recipe"
import { formatLlmsTxt, formatRecipeMarkdown } from "./recipeMarkdown"

const RECIPE_ID = "23762274-fc1b-4ff4-9710-d56b1e39a742"
const SECOND_ID = "6c436b4e-8d2e-4669-9342-ec6ec931ba73"
const ORIGIN = "https://manaaki.micsco.nz"

describe("formatRecipeMarkdown", () => {
  it("renders metadata, grouped ingredients, numbered steps, notes, and nutrition", () => {
    const recipe: RecipeOutput = {
      id: RECIPE_ID,
      name: "Sticky Beef",
      slug: "sticky-beef",
      description: "Sweet and savoury beef with cucumber.",
      recipeServings: 4,
      prepTimeSeconds: 900,
      performTimeSeconds: 1200,
      totalTimeSeconds: 2100,
      extras: { waitingTime: "30m marinating" },
      recipeCategory: [{ name: "Mains", slug: "mains" }],
      tags: [{ name: "Beef", slug: "beef" }],
      tools: [{ id: "tool-1", name: "Wok", slug: "wok" }],
      orgURL: "https://example.com/sticky-beef",
      recipeIngredient: [
        { title: "Beef", display: "Beef" },
        {
          quantity: 500,
          unit: { name: "gram", abbreviation: "g", useAbbreviation: true },
          food: { name: "beef strips" },
          substitutions: [{ substituteFood: { id: "sub-1", name: "pork strips" } }],
        },
        { title: "Salad", display: "1 cucumber, smashed" },
      ],
      recipeInstructions: [
        { title: "Cook", summary: "Sear", text: "Fry the beef on high heat." },
        { text: "Toss with sauce." },
      ],
      notes: [{ title: "Tip", text: "Serve immediately with steamed rice." }],
      settings: { showNutrition: true },
      nutrition: { calories: "510", proteinContent: "36" },
    }

    const markdown = formatRecipeMarkdown(recipe, `${ORIGIN}/`)
    const encoded = encodeRecipeId(RECIPE_ID)

    expect(markdown).toContain("# Sticky Beef")
    expect(markdown).toContain("> Sweet and savoury beef with cucumber.")
    expect(markdown).toContain(`- **URL**: ${ORIGIN}/recipes/${encoded}/sticky-beef`)
    expect(markdown).toContain("- **Servings**: 4")
    expect(markdown).toContain("- **Prep time**: 15m")
    expect(markdown).toContain("- **Cook time**: 20m")
    expect(markdown).toContain("- **Total time**: 35m (incl. 30m marinating)")
    expect(markdown).toContain("- **Categories**: Mains")
    expect(markdown).toContain("- **Tags**: Beef")
    expect(markdown).toContain("- **Tools**: Wok")
    expect(markdown).toContain("- **Source**: https://example.com/sticky-beef")
    expect(markdown).toContain(
      "_Saved from [example.com](https://example.com/sticky-beef) for our own household cooking."
    )
    expect(markdown).toContain("### Beef\n\n- 500 g beef strips (or pork strips)")
    expect(markdown).toContain("### Salad\n\n- 1 cucumber, smashed")
    expect(markdown).toContain("1. **Sear**: Fry the beef on high heat.")
    expect(markdown).toContain("2. Toss with sauce.")
    expect(markdown).toContain("## Notes\n\n### Tip\n\nServe immediately with steamed rice.")
    expect(markdown).toContain(
      "## Nutrition (per serving)\n\n- Calories: 510 kcal\n- Protein: 36 g"
    )
  })

  it("omits nutrition when showNutrition is false", () => {
    const markdown = formatRecipeMarkdown(
      {
        name: "Plain Rice",
        settings: { showNutrition: false },
        nutrition: { calories: "200" },
      },
      ORIGIN
    )

    expect(markdown).not.toContain("## Nutrition")
  })

  it("opens with YAML frontmatter carrying the canonical URL, source and attribution", () => {
    const markdown = formatRecipeMarkdown(
      {
        id: RECIPE_ID,
        name: 'Nan\'s "Best" Scones',
        slug: "scones",
        description: "Light scones.\nServe warm.",
        image: "abc",
        recipeServings: 8,
        prepTimeSeconds: 900,
        totalTimeSeconds: 2700,
        recipeCategory: [{ name: "Baking", slug: "baking" }],
        tags: [],
        dateAdded: "2025-01-02",
        orgURL: "https://www.bbcgoodfood.com/recipes/scones",
      },
      ORIGIN
    )
    const encoded = encodeRecipeId(RECIPE_ID)
    const frontmatter = markdown.slice(0, markdown.indexOf("\n---\n") + 5)

    expect(markdown.startsWith("---\n")).toBe(true)
    expect(frontmatter).toContain('title: "Nan\'s \\"Best\\" Scones"')
    expect(frontmatter).toContain('description: "Light scones.\\nServe warm."')
    expect(frontmatter).toContain(`canonical_url: "${ORIGIN}/recipes/${encoded}/scones"`)
    expect(frontmatter).toContain('source_url: "https://www.bbcgoodfood.com/recipes/scones"')
    expect(frontmatter).toContain('source_site: "bbcgoodfood.com"')
    expect(frontmatter).toContain('attribution: "Saved from bbcgoodfood.com')
    expect(frontmatter).toContain(
      `image: "${ORIGIN}/api/media/recipes/${RECIPE_ID}/images/original.webp?v=abc"`
    )
    expect(frontmatter).toContain("servings: 8")
    expect(frontmatter).toContain('prep_time: "PT15M"')
    expect(frontmatter).toContain('total_time: "PT45M"')
    expect(frontmatter).toContain('categories: ["Baking"]')
    expect(frontmatter).not.toContain("tags:")
    expect(frontmatter).toContain('date_published: "2025-01-02"')
    expect(markdown).toContain('---\n\n# Nan\'s "Best" Scones')
  })

  it("leaves source and attribution out for the household's own recipes", () => {
    const markdown = formatRecipeMarkdown(
      { id: RECIPE_ID, name: "Family Stew", slug: "family-stew" },
      ORIGIN
    )

    expect(markdown).toContain(`canonical_url: "${ORIGIN}/recipes/`)
    expect(markdown).not.toContain("source_url")
    expect(markdown).not.toContain("Saved from")
  })
})

describe("formatLlmsTxt", () => {
  it("groups recipes by primary category with Other last and links to .md URLs", () => {
    const recipes: RecipeSummary[] = [
      {
        id: RECIPE_ID,
        name: "Zesty Quinoa",
        slug: "zesty-quinoa",
        totalTime: "30 minutes",
        recipeServings: 4,
        description: "Quick lemon herb quinoa.",
        recipeCategory: [],
      },
      {
        id: SECOND_ID,
        name: "Baked [Cod]\nSupreme",
        slug: "baked-cod",
        totalTimeSeconds: 2000,
        description: "A".repeat(200),
        recipeCategory: [{ name: "Mains", slug: "mains" }],
        orgURL: "https://www.bbc.co.uk/food/recipes/baked_cod",
      },
    ]

    const txt = formatLlmsTxt(recipes, ORIGIN)
    const encodedFirst = encodeRecipeId(RECIPE_ID)
    const encodedSecond = encodeRecipeId(SECOND_ID)

    expect(txt).toContain("# Manaaki")
    expect(txt).toContain(`- [All recipes](${ORIGIN}/recipes):`)
    expect(txt).toContain(`- [Sitemap](${ORIGIN}/sitemap.xml):`)
    expect(txt.indexOf("## Mains")).toBeLessThan(txt.indexOf("## Other"))
    expect(txt).not.toContain("### ")
    expect(txt).toContain("Please do not use this collection to train models.")
    expect(txt).toContain(
      `- [Baked Cod Supreme](${ORIGIN}/recipes/${encodedSecond}/baked-cod.md): 33m — ${"A".repeat(159)}… Saved from bbc.co.uk (https://www.bbc.co.uk/food/recipes/baked_cod)`
    )
    expect(txt).toContain(
      `- [Zesty Quinoa](${ORIGIN}/recipes/${encodedFirst}/zesty-quinoa.md): 30m · Serves 4 — Quick lemon herb quinoa.`
    )
  })
})
