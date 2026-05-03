import { describe, expect, it } from "vitest"
import type { RecipeSummary } from "../api/generated/types.gen"
import { RecipeCardMeta } from "../components/RecipeCardMeta"
import { render, screen } from "../test/render"

const baseRecipe: RecipeSummary = {
  id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  slug: "banana-bread",
  name: "Banana Bread",
}

describe("RecipeCardMeta", () => {
  it("shows formatted time when totalTime is present", () => {
    render(<RecipeCardMeta recipe={{ ...baseRecipe, totalTime: "30 minutes" }} />)
    expect(screen.getByText("30m")).toBeInTheDocument()
  })

  it("shows hours and minutes formatted compactly", () => {
    render(<RecipeCardMeta recipe={{ ...baseRecipe, totalTime: "1 hour 15 minutes" }} />)
    expect(screen.getByText("1h 15m")).toBeInTheDocument()
  })

  it("shows freeform time strings as-is", () => {
    render(
      <RecipeCardMeta recipe={{ ...baseRecipe, totalTime: "10 mins, plus 2 hrs marinating" }} />
    )
    expect(screen.getByText("10 mins, plus 2 hrs marinating")).toBeInTheDocument()
  })

  it("does not show time when totalTime is null", () => {
    render(<RecipeCardMeta recipe={{ ...baseRecipe, totalTime: null }} />)
    expect(screen.queryByText(/h$|m$/)).not.toBeInTheDocument()
  })

  it("does not show time when totalTime is 'none'", () => {
    render(<RecipeCardMeta recipe={{ ...baseRecipe, totalTime: "none" }} />)
    expect(screen.queryByRole("time")).not.toBeInTheDocument()
  })

  it("shows servings when recipeServings > 0", () => {
    render(<RecipeCardMeta recipe={{ ...baseRecipe, recipeServings: 4 }} />)
    expect(screen.getByText(/4 servings/)).toBeInTheDocument()
  })

  it("shows singular 'serving' when recipeServings is 1", () => {
    render(<RecipeCardMeta recipe={{ ...baseRecipe, recipeServings: 1 }} />)
    expect(screen.getByText(/1 serving/)).toBeInTheDocument()
    expect(screen.queryByText(/1 servings/)).not.toBeInTheDocument()
  })

  it("does not show servings when recipeServings is 0", () => {
    render(<RecipeCardMeta recipe={{ ...baseRecipe, recipeServings: 0 }} />)
    expect(screen.queryByText(/serving/)).not.toBeInTheDocument()
  })

  it("does not show servings when recipeServings is undefined", () => {
    render(<RecipeCardMeta recipe={{ ...baseRecipe, recipeServings: undefined }} />)
    expect(screen.queryByText(/serving/)).not.toBeInTheDocument()
  })

  it("shows rating when present", () => {
    render(<RecipeCardMeta recipe={{ ...baseRecipe, rating: 5 }} />)
    expect(screen.getByText("5.0")).toBeInTheDocument()
  })

  it("does not show rating when rating is null", () => {
    render(<RecipeCardMeta recipe={{ ...baseRecipe, rating: null }} />)
    expect(screen.queryByText(/\d\.\d/)).not.toBeInTheDocument()
  })

  it("renders nothing visible when all fields are absent", () => {
    const { container } = render(<RecipeCardMeta recipe={baseRecipe} />)
    expect(container.firstElementChild?.children.length).toBe(0)
  })

  it("does not render the recipe description", () => {
    render(
      <RecipeCardMeta
        recipe={{ ...baseRecipe, description: "A lovely moist banana bread recipe." }}
      />
    )
    expect(screen.queryByText(/lovely moist/)).not.toBeInTheDocument()
  })
})
