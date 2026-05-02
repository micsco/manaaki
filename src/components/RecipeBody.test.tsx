import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { describe, expect, it } from "vitest"
import type { RecipeOutput } from "../api/generated/types.gen"
import { CookModeProvider } from "../contexts/CookModeContext"
import { render, screen } from "../test/render"
import { RecipeBody } from "./RecipeBody"

const minimalRecipe: RecipeOutput = {
  id: "recipe-1",
  slug: "pasta",
  name: "Pasta",
  recipeIngredient: [
    {
      display: "200g pasta",
      originalText: "200g pasta",
      quantity: 200,
      food: { name: "pasta" },
      unit: null,
      note: null,
      title: null,
    },
  ],
  recipeInstructions: [{ id: "step-1", text: "Boil water.", title: null }],
  notes: [],
}

function CookModeWrapper({
  children,
  cookMode = false,
}: {
  children: React.ReactNode
  cookMode?: boolean
}) {
  return (
    <NuqsTestingAdapter searchParams={cookMode ? "cook=true" : ""}>
      <CookModeProvider>{children}</CookModeProvider>
    </NuqsTestingAdapter>
  )
}

describe("RecipeBody", () => {
  describe("normal mode", () => {
    it("renders the Ingredients section", () => {
      render(<RecipeBody recipe={minimalRecipe} />)
      expect(screen.getByRole("heading", { name: /ingredients/i })).toBeInTheDocument()
    })

    it("renders the Method section", () => {
      render(<RecipeBody recipe={minimalRecipe} />)
      expect(screen.getByRole("heading", { name: /method/i })).toBeInTheDocument()
    })

    it("renders the source URL when provided", () => {
      const recipeWithSource: RecipeOutput = {
        ...minimalRecipe,
        orgURL: "https://example.com/pasta",
      }
      render(<RecipeBody recipe={recipeWithSource} />)
      expect(
        screen.getByRole("link", { name: /https:\/\/example.com\/pasta/i })
      ).toBeInTheDocument()
    })

    it("does not render source link when orgURL is absent", () => {
      render(<RecipeBody recipe={minimalRecipe} />)
      expect(screen.queryByText(/source/i)).not.toBeInTheDocument()
    })

    it("renders notes when present", () => {
      const recipeWithNotes: RecipeOutput = {
        ...minimalRecipe,
        notes: [{ title: "Tip", text: "Use fresh pasta." }],
      }
      render(<RecipeBody recipe={recipeWithNotes} />)
      expect(screen.getByText("Use fresh pasta.")).toBeInTheDocument()
    })

    it("renders nothing when there are no ingredients or instructions", () => {
      const emptyRecipe: RecipeOutput = {
        ...minimalRecipe,
        recipeIngredient: [],
        recipeInstructions: [],
      }
      const { container } = render(<RecipeBody recipe={emptyRecipe} />)
      expect(container.querySelector("section")).not.toBeInTheDocument()
    })
  })

  describe("cook mode", () => {
    it("does not render source link in cook mode", () => {
      const recipeWithSource: RecipeOutput = {
        ...minimalRecipe,
        orgURL: "https://example.com/pasta",
      }
      render(<RecipeBody recipe={recipeWithSource} />, {
        wrapper: ({ children }) => <CookModeWrapper cookMode>{children}</CookModeWrapper>,
      })
      expect(screen.queryByText(/source/i)).not.toBeInTheDocument()
    })
  })
})
