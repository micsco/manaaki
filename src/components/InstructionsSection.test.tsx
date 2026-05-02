import { describe, expect, it } from "vitest"
import type { RecipeStep } from "../api/generated/types.gen"
import { CookModeWrapper, render, screen } from "../test/render"
import { InstructionsSection } from "./InstructionsSection"

const steps: RecipeStep[] = [
  { id: "step-1", text: "Boil the water.", title: null },
  { id: "step-2", text: "Add the pasta.", title: null },
]

const stepsWithSection: RecipeStep[] = [
  { id: "step-0", text: "Section step", title: "Prep" },
  { id: "step-1", text: "Boil the water.", title: null },
  { id: "step-2", text: "Start sauce", title: "Sauce" },
  { id: "step-3", text: "Add tomatoes.", title: null },
]

describe("InstructionsSection", () => {
  describe("normal mode", () => {
    it("renders the Method heading", () => {
      render(<InstructionsSection steps={steps} recipeId="recipe-1" />)
      expect(screen.getByRole("heading", { name: /method/i })).toBeInTheDocument()
    })

    it("renders all steps as buttons", () => {
      render(<InstructionsSection steps={steps} recipeId="recipe-1" />)
      expect(screen.getAllByRole("button", { name: /step/i })).toHaveLength(2)
    })

    it("renders the cook mode toggle button", () => {
      render(<InstructionsSection steps={steps} recipeId="recipe-1" />)
      expect(screen.getByRole("button", { name: /cook mode/i })).toBeInTheDocument()
    })

    it("renders section titles when steps have titles", () => {
      render(<InstructionsSection steps={stepsWithSection} recipeId="recipe-1" />)
      expect(screen.getByText("Prep")).toBeInTheDocument()
      expect(screen.getByText("Sauce")).toBeInTheDocument()
    })
  })

  describe("cook mode", () => {
    it("still renders the Method heading in cook mode", () => {
      render(<InstructionsSection steps={steps} recipeId="recipe-1" />, {
        wrapper: ({ children }) => <CookModeWrapper cookMode>{children}</CookModeWrapper>,
      })
      expect(screen.getByRole("heading", { name: /method/i })).toBeInTheDocument()
    })

    it("renders all steps in cook mode", () => {
      render(<InstructionsSection steps={steps} recipeId="recipe-1" />, {
        wrapper: ({ children }) => <CookModeWrapper cookMode>{children}</CookModeWrapper>,
      })
      expect(screen.getAllByRole("button", { name: /step/i })).toHaveLength(2)
    })

    it("does not render the cook mode toggle in cook mode", () => {
      render(<InstructionsSection steps={steps} recipeId="recipe-1" />, {
        wrapper: ({ children }) => <CookModeWrapper cookMode>{children}</CookModeWrapper>,
      })
      expect(screen.queryByRole("button", { name: /cook mode/i })).not.toBeInTheDocument()
    })

    it("shows a photo toggle button when img is provided in cook mode", () => {
      render(<InstructionsSection steps={steps} recipeId="recipe-1" img="/photo.jpg" />, {
        wrapper: ({ children }) => <CookModeWrapper cookMode>{children}</CookModeWrapper>,
      })
      expect(screen.getByRole("button", { name: /show photo/i })).toBeInTheDocument()
    })

    it("does not show photo toggle when no img is provided", () => {
      render(<InstructionsSection steps={steps} recipeId="recipe-1" />, {
        wrapper: ({ children }) => <CookModeWrapper cookMode>{children}</CookModeWrapper>,
      })
      expect(screen.queryByRole("button", { name: /photo/i })).not.toBeInTheDocument()
    })
  })
})
