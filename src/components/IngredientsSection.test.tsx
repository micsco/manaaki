import { describe, expect, it } from "vitest"
import type { RecipeIngredientOutput } from "../api/generated/types.gen"
import { CookModeWrapper, render, screen } from "../test/render"
import { IngredientsSection } from "./IngredientsSection"

const ingredients: RecipeIngredientOutput[] = [
  {
    display: "2 cups flour",
    originalText: "2 cups flour",
    quantity: 2,
    food: { name: "flour" },
    unit: null,
    note: null,
    title: null,
    referenceId: "1",
  },
  {
    display: "1 egg",
    originalText: "1 egg",
    quantity: 1,
    food: { name: "egg" },
    unit: null,
    note: null,
    title: null,
    referenceId: "2",
  },
]

const ingredientsWithSection: RecipeIngredientOutput[] = [
  {
    title: "Dry ingredients",
    originalText: null,
    quantity: null,
    food: null,
    unit: null,
    note: null,
    referenceId: "section",
  },
  ...ingredients,
]

describe("IngredientsSection", () => {
  describe("normal mode", () => {
    it("renders the Ingredients heading", () => {
      render(<IngredientsSection ingredients={ingredients} recipeId="test-recipe" />)
      expect(screen.getByRole("heading", { name: /ingredients/i })).toBeInTheDocument()
    })

    it("renders all ingredients", () => {
      render(<IngredientsSection ingredients={ingredients} recipeId="test-recipe" />)
      expect(screen.getAllByRole("button")).toHaveLength(2)
    })

    it("renders section title when ingredient has a title", () => {
      render(<IngredientsSection ingredients={ingredientsWithSection} recipeId="test-recipe" />)
      expect(screen.getByText("Dry ingredients")).toBeInTheDocument()
    })

    it("does not render a button for section title items", () => {
      render(<IngredientsSection ingredients={ingredientsWithSection} recipeId="test-recipe" />)
      expect(screen.getAllByRole("button")).toHaveLength(2)
    })
  })

  describe("cook mode", () => {
    it("still renders the Ingredients heading", () => {
      render(<IngredientsSection ingredients={ingredients} recipeId="test-recipe" />, {
        wrapper: ({ children }) => <CookModeWrapper cookMode>{children}</CookModeWrapper>,
      })
      expect(screen.getByRole("heading", { name: /ingredients/i })).toBeInTheDocument()
    })

    it("renders all ingredient buttons", () => {
      render(<IngredientsSection ingredients={ingredients} recipeId="test-recipe" />, {
        wrapper: ({ children }) => <CookModeWrapper cookMode>{children}</CookModeWrapper>,
      })
      expect(screen.getAllByRole("button")).toHaveLength(2)
    })

    it("renders section titles in cook mode too", () => {
      render(<IngredientsSection ingredients={ingredientsWithSection} recipeId="test-recipe" />, {
        wrapper: ({ children }) => <CookModeWrapper cookMode>{children}</CookModeWrapper>,
      })
      expect(screen.getByText("Dry ingredients")).toBeInTheDocument()
    })
  })
})
