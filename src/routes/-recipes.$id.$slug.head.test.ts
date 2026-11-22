import { describe, expect, it } from "vitest"

import type { RecipeOutput } from "../api/generated/types.gen"
import { encodeRecipeId } from "../utils/recipe"
import { Route as RecipeDetailRoute } from "./recipes.$id.$slug"
import { Route as RecipesIndexRoute } from "./recipes.index"

const RECIPE_ID = "23762274-fc1b-4ff4-9710-d56b1e39a742"
const ENCODED_ID = encodeRecipeId(RECIPE_ID)

describe("recipe route head discovery metadata", () => {
  it("emits schema.org/Recipe JSON-LD, description, canonical link, and markdown alternate link", () => {
    const loaderData: RecipeOutput = {
      id: RECIPE_ID,
      name: "Swedish Meatballs",
      slug: "swedish-meatballs",
      description: "Juicy meatballs in creamy gravy.",
      recipeIngredient: [{ display: "500g beef mince" }],
      recipeInstructions: [{ text: "Bake for 20 minutes." }],
    }

    const headFn = RecipeDetailRoute.options.head
    expect(headFn).toBeDefined()
    const head = headFn!({ loaderData } as never) as {
      meta?: Record<string, unknown>[]
      links?: Record<string, string>[]
    }

    const jsonLdEntry = head.meta?.find(entry => "script:ld+json" in entry)
    expect(jsonLdEntry).toBeDefined()
    expect(jsonLdEntry?.["script:ld+json"]).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: "Swedish Meatballs",
      recipeIngredient: ["500g beef mince"],
    })

    expect(head.meta).toContainEqual({
      name: "description",
      content: "Juicy meatballs in creamy gravy.",
    })
    expect(head.links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rel: "canonical",
          href: expect.stringContaining(`/recipes/${ENCODED_ID}/swedish-meatballs`),
        }),
        expect.objectContaining({
          rel: "alternate",
          type: "text/markdown",
          href: expect.stringContaining(`/recipes/${ENCODED_ID}/swedish-meatballs.md`),
        }),
      ])
    )
  })

  it("advertises /llms.txt from the /recipes index head", () => {
    const headFn = RecipesIndexRoute.options.head
    expect(headFn).toBeDefined()
    const head = headFn!({} as never) as { links?: Record<string, string>[] }

    expect(head.links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rel: "alternate",
          type: "text/plain",
          href: expect.stringMatching(/\/llms\.txt$/),
        }),
      ])
    )
  })
})
