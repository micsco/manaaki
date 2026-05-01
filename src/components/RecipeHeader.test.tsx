import { describe, expect, it, vi } from "vitest"
import type { RecipeOutput } from "../api/generated/types.gen"
import type { RecipeNavItem } from "../hooks/useRecipeNav"
import { render, screen } from "../test/render"
import { encodeRecipeId } from "../utils/recipe"
import { RecipeHeader } from "./RecipeHeader"

vi.mock("../hooks/useGroupSlug", () => ({
  useGroupSlug: () => "scottfamily",
}))

vi.mock("@tanstack/react-router", async importOriginal => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>()
  return {
    ...actual,
    Link: ({ to, children, ...props }: any) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  }
})

const minimalRecipe: RecipeOutput = {
  id: "abc123",
  slug: "banana-bread",
  name: "Banana Bread",
  recipeIngredient: [],
  recipeInstructions: [],
}

const prevRecipe: RecipeNavItem = { id: "prev111", slug: "apple-pie", name: "Apple Pie" }
const nextRecipe: RecipeNavItem = { id: "next222", slug: "carrot-cake", name: "Carrot Cake" }

describe("RecipeHeader", () => {
  it("renders the recipe title", () => {
    render(<RecipeHeader recipe={minimalRecipe} img={null} />)
    expect(screen.getByRole("heading", { name: /banana bread/i })).toBeInTheDocument()
  })

  it("renders an 'All recipes' back link", () => {
    render(<RecipeHeader recipe={minimalRecipe} img={null} />)
    expect(screen.getByRole("link", { name: /all recipes/i })).toBeInTheDocument()
  })

  it("does not render prev/next buttons when no recipes are provided", () => {
    render(<RecipeHeader recipe={minimalRecipe} img={null} />)
    expect(screen.queryByRole("link", { name: /previous recipe/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /next recipe/i })).not.toBeInTheDocument()
  })

  it("renders both prev and next buttons when both recipes are provided", () => {
    render(
      <RecipeHeader
        recipe={minimalRecipe}
        img={null}
        prevRecipe={prevRecipe}
        nextRecipe={nextRecipe}
      />
    )
    expect(screen.getByRole("link", { name: /previous recipe/i })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /next recipe/i })).toBeInTheDocument()
  })

  it("links prev button to the correct encoded recipe URL", () => {
    render(
      <RecipeHeader
        recipe={minimalRecipe}
        img={null}
        prevRecipe={prevRecipe}
        nextRecipe={nextRecipe}
      />
    )
    expect(screen.getByRole("link", { name: /previous recipe/i })).toHaveAttribute(
      "href",
      `/recipes/${encodeRecipeId("prev111")}/apple-pie`
    )
  })

  it("links next button to the correct encoded recipe URL", () => {
    render(
      <RecipeHeader
        recipe={minimalRecipe}
        img={null}
        prevRecipe={prevRecipe}
        nextRecipe={nextRecipe}
      />
    )
    expect(screen.getByRole("link", { name: /next recipe/i })).toHaveAttribute(
      "href",
      `/recipes/${encodeRecipeId("next222")}/carrot-cake`
    )
  })

  it("does not render nav buttons when both recipes are null", () => {
    render(<RecipeHeader recipe={minimalRecipe} img={null} prevRecipe={null} nextRecipe={null} />)
    expect(screen.queryByRole("link", { name: /previous recipe/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /next recipe/i })).not.toBeInTheDocument()
  })

  it("renders a 'View in Mealie' link with the correct URL", () => {
    render(<RecipeHeader recipe={minimalRecipe} img={null} />)
    const link = screen.getByRole("link", { name: /view in mealie/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute(
      "href",
      "https://mealie.scottfamily.nz/g/scottfamily/r/banana-bread"
    )
  })

  it("opens the Mealie link in a new tab", () => {
    render(<RecipeHeader recipe={minimalRecipe} img={null} />)
    expect(screen.getByRole("link", { name: /view in mealie/i })).toHaveAttribute(
      "target",
      "_blank"
    )
  })

  it("does not render the Mealie link when the recipe has no slug", () => {
    render(<RecipeHeader recipe={{ ...minimalRecipe, slug: undefined }} img={null} />)
    expect(screen.queryByRole("link", { name: /view in mealie/i })).not.toBeInTheDocument()
  })
})
