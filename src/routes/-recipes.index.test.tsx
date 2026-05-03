import { describe, expect, it } from "vitest"
import type { RecipeSummary } from "../api/generated/types.gen"
import { RecipeCardInfoBadges, RecipeCardToolBadges } from "../components/RecipeCardMeta"
import { render, screen } from "../test/render"

const baseRecipe: RecipeSummary = {
  id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  slug: "banana-bread",
  name: "Banana Bread",
}

describe("RecipeCardInfoBadges", () => {
  it("shows formatted time when totalTime is present", () => {
    render(<RecipeCardInfoBadges recipe={{ ...baseRecipe, totalTime: "30 minutes" }} />)
    expect(screen.getByText("30m")).toBeInTheDocument()
  })

  it("shows hours and minutes formatted compactly", () => {
    render(<RecipeCardInfoBadges recipe={{ ...baseRecipe, totalTime: "1 hour 15 minutes" }} />)
    expect(screen.getByText("1h 15m")).toBeInTheDocument()
  })

  it("shows freeform time strings as-is", () => {
    render(
      <RecipeCardInfoBadges
        recipe={{ ...baseRecipe, totalTime: "10 mins, plus 2 hrs marinating" }}
      />
    )
    expect(screen.getByText("10 mins, plus 2 hrs marinating")).toBeInTheDocument()
  })

  it("does not show time when totalTime is null", () => {
    render(<RecipeCardInfoBadges recipe={{ ...baseRecipe, totalTime: null }} />)
    expect(screen.queryByText(/h$|m$/)).not.toBeInTheDocument()
  })

  it("does not show time when totalTime is 'none'", () => {
    render(<RecipeCardInfoBadges recipe={{ ...baseRecipe, totalTime: "none" }} />)
    expect(screen.queryByRole("time")).not.toBeInTheDocument()
  })

  it("does not show servings", () => {
    render(<RecipeCardInfoBadges recipe={{ ...baseRecipe, recipeServings: 4 }} />)
    expect(screen.queryByText(/serving/)).not.toBeInTheDocument()
  })

  it("shows rating when present", () => {
    render(<RecipeCardInfoBadges recipe={{ ...baseRecipe, rating: 5 }} />)
    expect(screen.getByText("5.0")).toBeInTheDocument()
  })

  it("does not show rating when rating is null", () => {
    render(<RecipeCardInfoBadges recipe={{ ...baseRecipe, rating: null }} />)
    expect(screen.queryByText(/\d\.\d/)).not.toBeInTheDocument()
  })

  it("renders nothing visible when all fields are absent", () => {
    const { container } = render(<RecipeCardInfoBadges recipe={baseRecipe} />)
    expect(container.firstElementChild?.children.length).toBe(0)
  })

  it("does not render the recipe description", () => {
    render(
      <RecipeCardInfoBadges
        recipe={{ ...baseRecipe, description: "A lovely moist banana bread recipe." }}
      />
    )
    expect(screen.queryByText(/lovely moist/)).not.toBeInTheDocument()
  })
})

describe("RecipeCardToolBadges", () => {
  describe("slow cooker", () => {
    it("shows slow cooker badge when tools array contains 'Slow Cooker'", () => {
      render(
        <RecipeCardToolBadges
          recipe={{ ...baseRecipe, tools: [{ id: "1", name: "Slow Cooker", slug: "slow-cooker" }] }}
        />
      )
      expect(screen.getByText("Slow cooker")).toBeInTheDocument()
    })

    it("shows slow cooker badge when a tag matches", () => {
      render(
        <RecipeCardToolBadges
          recipe={{ ...baseRecipe, tags: [{ name: "Slow Cooker", slug: "slow-cooker" }] }}
        />
      )
      expect(screen.getByText("Slow cooker")).toBeInTheDocument()
    })

    it("shows slow cooker badge when a category matches", () => {
      render(
        <RecipeCardToolBadges
          recipe={{
            ...baseRecipe,
            recipeCategory: [{ name: "Slow Cooker Meals", slug: "slow-cooker-meals" }],
          }}
        />
      )
      expect(screen.getByText("Slow cooker")).toBeInTheDocument()
    })

    it("matches case-insensitively", () => {
      render(
        <RecipeCardToolBadges
          recipe={{ ...baseRecipe, tools: [{ id: "1", name: "slow cooker", slug: "slow-cooker" }] }}
        />
      )
      expect(screen.getByText("Slow cooker")).toBeInTheDocument()
    })
  })

  describe("air fryer", () => {
    it("shows air fryer badge when tools array contains 'Air Fryer'", () => {
      render(
        <RecipeCardToolBadges
          recipe={{ ...baseRecipe, tools: [{ id: "2", name: "Air Fryer", slug: "air-fryer" }] }}
        />
      )
      expect(screen.getByText("Air fryer")).toBeInTheDocument()
    })

    it("matches case-insensitively", () => {
      render(
        <RecipeCardToolBadges
          recipe={{ ...baseRecipe, tools: [{ id: "2", name: "air fryer", slug: "air-fryer" }] }}
        />
      )
      expect(screen.getByText("Air fryer")).toBeInTheDocument()
    })
  })

  it("shows multiple tool badges when multiple tools match", () => {
    render(
      <RecipeCardToolBadges
        recipe={{
          ...baseRecipe,
          tools: [
            { id: "1", name: "Slow Cooker", slug: "slow-cooker" },
            { id: "2", name: "Air Fryer", slug: "air-fryer" },
          ],
        }}
      />
    )
    expect(screen.getByText("Slow cooker")).toBeInTheDocument()
    expect(screen.getByText("Air fryer")).toBeInTheDocument()
  })

  it("renders nothing when no matching tools, tags or categories", () => {
    const { container } = render(
      <RecipeCardToolBadges
        recipe={{
          ...baseRecipe,
          tools: [{ id: "3", name: "Stand Mixer", slug: "stand-mixer" }],
          tags: [{ name: "Dinner", slug: "dinner" }],
        }}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it("renders nothing when tools, tags and categories are all empty", () => {
    const { container } = render(
      <RecipeCardToolBadges recipe={{ ...baseRecipe, tools: [], tags: [], recipeCategory: [] }} />
    )
    expect(container.firstChild).toBeNull()
  })
})
