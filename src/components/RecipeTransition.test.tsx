import { render, screen } from "@testing-library/react"
import { addTransitionType } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { markRecipeNavigation, takeRecipeNavigation } from "../lib/recipeTransition"
import { RecipeTransition, useDisplayedRecipe } from "./RecipeTransition"

vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof import("react")>()
  return { ...actual, addTransitionType: vi.fn(actual.addTransitionType) }
})

function RecipePage({ recipe }: { recipe: { id: string; name: string } }) {
  const displayed = useDisplayedRecipe(recipe)
  return (
    <RecipeTransition recipeId={displayed.id}>
      <h1>{displayed.name}</h1>
    </RecipeTransition>
  )
}

const soup = { id: "soup", name: "Soup" }
const curry = { id: "curry", name: "Curry" }

describe("RecipeTransition", () => {
  afterEach(() => {
    takeRecipeNavigation("")
    vi.unstubAllGlobals()
  })

  it("tags the swap with the direction the cook navigated", async () => {
    const { rerender } = render(<RecipePage recipe={soup} />)
    markRecipeNavigation("curry", "next")
    rerender(<RecipePage recipe={curry} />)
    expect(await screen.findByRole("heading", { name: "Curry" })).toBeInTheDocument()
    expect(addTransitionType).toHaveBeenCalledWith("recipe-next")
  })

  it("uses the opposite type for previous recipes", async () => {
    const { rerender } = render(<RecipePage recipe={curry} />)
    markRecipeNavigation("soup", "prev")
    rerender(<RecipePage recipe={soup} />)
    expect(await screen.findByRole("heading", { name: "Soup" })).toBeInTheDocument()
    expect(addTransitionType).toHaveBeenCalledWith("recipe-prev")
  })

  it("does not animate navigation without an explicit direction", async () => {
    const { rerender } = render(<RecipePage recipe={soup} />)
    rerender(<RecipePage recipe={curry} />)
    expect(await screen.findByRole("heading", { name: "Curry" })).toBeInTheDocument()
    expect(addTransitionType).not.toHaveBeenCalled()
  })

  it("respects reduced motion", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true }))
    )
    const { rerender } = render(<RecipePage recipe={soup} />)
    markRecipeNavigation("curry", "next")
    rerender(<RecipePage recipe={curry} />)
    expect(await screen.findByRole("heading", { name: "Curry" })).toBeInTheDocument()
    expect(addTransitionType).not.toHaveBeenCalled()
  })

  it("replaces the page when the recipe changes", async () => {
    const { rerender } = render(<RecipePage recipe={soup} />)
    rerender(<RecipePage recipe={curry} />)
    expect(await screen.findByRole("heading", { name: "Curry" })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Soup" })).not.toBeInTheDocument()
  })
})
