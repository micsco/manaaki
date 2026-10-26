import { describe, expect, it } from "vitest"

import type { RecipeOutput } from "../../src/api/generated/types.gen"
import { caseInput } from "./caseInput"

const recipe = (steps: string[]): RecipeOutput => ({
  name: "Chicken salad",
  recipeIngredient: [{ display: "4 chicken thighs", quantity: 4 }],
  recipeInstructions: steps.map(text => ({ text })),
  tools: [],
})

describe("caseInput", () => {
  it("moves the author's alternative method out of the steps and into the reference", () => {
    const input = caseInput(
      {
        slug: "salad",
        target: "oven",
        method: "airFryer",
        referenceInSteps: /\s*Alternatively, bake in the oven[^.]*\./g,
        why: "",
      },
      recipe([
        "Air fry at 200°C for 20 minutes. Alternatively, bake in the oven at 200°C for 30 minutes.",
        "Slice and serve.",
      ])
    )
    expect(input.recipe.method).toBe("airFryer")
    expect(input.recipe.steps).toEqual(["Air fry at 200°C for 20 minutes.", "Slice and serve."])
    expect(input.source.steps).toEqual(input.recipe.steps)
    expect(input.reference).toBe("Alternatively, bake in the oven at 200°C for 30 minutes.")
  })

  it("uses another recipe's numbered steps as the reference, and none by default", () => {
    const original = recipe(["Bake at 200°C for 1 hour."])
    expect(caseInput({ slug: "a", target: "airFryer", why: "" }, original).reference).toBeNull()
    expect(
      caseInput(
        { slug: "a", target: "airFryer", why: "" },
        original,
        recipe(["Air fry at 190°C for 40 minutes.", "Fill and crisp."])
      ).reference
    ).toBe("1. Air fry at 190°C for 40 minutes.\n2. Fill and crisp.")
  })
})
