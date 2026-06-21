import { describe, expect, it, vi } from "vitest"
import type { RecipeOutput } from "../api/generated/types.gen"
import { render, screen } from "../test/render"
import { RecipeFooter } from "./RecipeFooter"

vi.mock("../hooks/useGroupSlug", () => ({
  useGroupSlug: () => "scottfamily",
}))

const recipe: RecipeOutput = {
  id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  slug: "banana-bread",
  name: "Banana Bread",
  recipeIngredient: [],
  recipeInstructions: [],
  notes: [],
}

describe("RecipeFooter", () => {
  it("renders the source as a cleaned domain linking to the full URL", () => {
    render(
      <RecipeFooter recipe={{ ...recipe, orgURL: "https://www.bbcgoodfood.com/recipes/123" }} />
    )
    const link = screen.getByRole("link", { name: "bbcgoodfood.com" })
    expect(link).toHaveAttribute("href", "https://www.bbcgoodfood.com/recipes/123")
    expect(link).toHaveAttribute("target", "_blank")
  })

  it("does not render a source when orgURL is absent", () => {
    render(<RecipeFooter recipe={recipe} />)
    expect(screen.queryByText(/source:/i)).not.toBeInTheDocument()
  })

  it("renders a 'View in Mealie' link with the correct URL", () => {
    render(<RecipeFooter recipe={recipe} />)
    const link = screen.getByRole("link", { name: /view in mealie/i })
    expect(link).toHaveAttribute(
      "href",
      "https://mealie.scottfamily.nz/g/scottfamily/r/banana-bread"
    )
    expect(link).toHaveAttribute("target", "_blank")
  })

  it("does not render the Mealie link when the recipe has no slug", () => {
    render(<RecipeFooter recipe={{ ...recipe, slug: undefined }} />)
    expect(screen.queryByRole("link", { name: /view in mealie/i })).not.toBeInTheDocument()
  })
})
