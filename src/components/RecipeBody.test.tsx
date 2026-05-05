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
      const headings = screen.getAllByRole("heading", { name: /ingredients/i })
      expect(headings.length).toBeGreaterThan(0)
    })

    it("renders the Method section", () => {
      render(<RecipeBody recipe={minimalRecipe} />)
      const headings = screen.getAllByRole("heading", { name: /method/i })
      expect(headings.length).toBeGreaterThan(0)
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

    it("renders no ingredient or method sections when there are none", () => {
      const emptyRecipe: RecipeOutput = {
        ...minimalRecipe,
        recipeIngredient: [],
        recipeInstructions: [],
      }
      render(<RecipeBody recipe={emptyRecipe} />)
      expect(screen.queryByRole("heading", { name: /ingredients/i })).not.toBeInTheDocument()
      expect(screen.queryByRole("heading", { name: /method/i })).not.toBeInTheDocument()
    })

    it("renders the mobile tab bar with Ingredients and Method tabs", () => {
      render(<RecipeBody recipe={minimalRecipe} />)
      expect(screen.getByRole("tab", { name: /ingredients/i })).toBeInTheDocument()
      expect(screen.getByRole("tab", { name: /method/i })).toBeInTheDocument()
    })

    it("renders a Description tab when the recipe has a description", () => {
      const recipeWithDesc: RecipeOutput = {
        ...minimalRecipe,
        description: "A simple pasta recipe.",
      }
      render(<RecipeBody recipe={recipeWithDesc} />)
      expect(screen.getByRole("tab", { name: /description/i })).toBeInTheDocument()
    })

    it("renders a Description tab when the recipe has categories", () => {
      const recipeWithCats: RecipeOutput = {
        ...minimalRecipe,
        recipeCategory: [{ id: "c1", slug: "dinner", name: "Dinner", groupId: "g1" }],
      }
      render(<RecipeBody recipe={recipeWithCats} />)
      expect(screen.getByRole("tab", { name: /description/i })).toBeInTheDocument()
    })

    it("does not render the Description tab when there is no description, categories or tags", () => {
      render(<RecipeBody recipe={minimalRecipe} />)
      expect(screen.queryByRole("tab", { name: /description/i })).not.toBeInTheDocument()
    })

    it("renders description and tags in the desktop description row", () => {
      const recipeWithAll: RecipeOutput = {
        ...minimalRecipe,
        description: "A rich pasta.",
        recipeCategory: [{ id: "c1", slug: "dinner", name: "Dinner", groupId: "g1" }],
        tags: [{ id: "t1", slug: "italian", name: "Italian", groupId: "g1" }],
      }
      render(<RecipeBody recipe={recipeWithAll} />)
      expect(screen.getAllByText("A rich pasta.").length).toBeGreaterThan(0)
      expect(screen.getAllByText("Dinner").length).toBeGreaterThan(0)
      expect(screen.getAllByText("Italian").length).toBeGreaterThan(0)
    })

    it("renders the nutrition panel when showNutrition is true and data is present", () => {
      const recipeWithNutrition: RecipeOutput = {
        ...minimalRecipe,
        nutrition: {
          calories: "400",
          proteinContent: "30",
          carbohydrateContent: "50",
          fatContent: "10",
        },
        settings: { showNutrition: true },
      }
      render(<RecipeBody recipe={recipeWithNutrition} />)
      expect(
        screen.getAllByRole("region", { name: /nutrition information/i }).length
      ).toBeGreaterThan(0)
    })

    it("does not render the nutrition panel when showNutrition is false", () => {
      const recipeWithNutrition: RecipeOutput = {
        ...minimalRecipe,
        nutrition: {
          calories: "400",
          proteinContent: "30",
        },
        settings: { showNutrition: false },
      }
      render(<RecipeBody recipe={recipeWithNutrition} />)
      expect(
        screen.queryByRole("region", { name: /nutrition information/i })
      ).not.toBeInTheDocument()
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

    it("does not render mobile tabs in cook mode", () => {
      render(<RecipeBody recipe={minimalRecipe} />, {
        wrapper: ({ children }) => <CookModeWrapper cookMode>{children}</CookModeWrapper>,
      })
      expect(screen.queryByRole("tablist")).not.toBeInTheDocument()
    })

    it("does not render the nutrition panel in cook mode", () => {
      const recipeWithNutrition: RecipeOutput = {
        ...minimalRecipe,
        nutrition: { calories: "400", proteinContent: "30" },
        settings: { showNutrition: true },
      }
      render(<RecipeBody recipe={recipeWithNutrition} />, {
        wrapper: ({ children }) => <CookModeWrapper cookMode>{children}</CookModeWrapper>,
      })
      expect(
        screen.queryByRole("region", { name: /nutrition information/i })
      ).not.toBeInTheDocument()
    })
  })
})
