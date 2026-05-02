import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import type { RecipeStep } from "../api/generated/types.gen"
import { render, screen } from "../test/render"
import { InstructionStep } from "./InstructionStep"

const step: RecipeStep = { id: "step-1", text: "Boil the water.", title: null }

describe("InstructionStep", () => {
  describe("rendering", () => {
    it("renders the step text", () => {
      render(<InstructionStep step={step} index={0} recipeId="recipe-1" />)
      expect(screen.getByText("Boil the water.")).toBeInTheDocument()
    })

    it("renders the step number", () => {
      render(<InstructionStep step={step} index={0} recipeId="recipe-1" />)
      expect(screen.getByText("1.")).toBeInTheDocument()
    })

    it("shows step number offset by index", () => {
      render(<InstructionStep step={step} index={2} recipeId="recipe-1" />)
      expect(screen.getByText("3.")).toBeInTheDocument()
    })

    it("renders a button with correct aria-label when unchecked", () => {
      render(<InstructionStep step={step} index={0} recipeId="recipe-1" />)
      const btn = screen.getByRole("button")
      expect(btn).toHaveAttribute("aria-label", "Step 1")
    })

    it("does not show a check icon when unchecked", () => {
      render(<InstructionStep step={step} index={0} recipeId="recipe-1" />)
      expect(screen.queryByRole("img", { hidden: true })).not.toBeInTheDocument()
    })
  })

  describe("toggle behaviour", () => {
    it("marks as completed when clicked", async () => {
      const user = userEvent.setup()
      render(<InstructionStep step={step} index={0} recipeId="recipe-1" />)

      await user.click(screen.getByRole("button"))

      expect(screen.getByRole("button")).toHaveAttribute("aria-label", "Step 1, completed")
    })

    it("unmarks as completed when clicked a second time", async () => {
      const user = userEvent.setup()
      render(<InstructionStep step={step} index={0} recipeId="recipe-1" />)

      await user.click(screen.getByRole("button"))
      await user.click(screen.getByRole("button"))

      expect(screen.getByRole("button")).toHaveAttribute("aria-label", "Step 1")
    })
  })

  describe("session storage persistence", () => {
    it("persists checked state to sessionStorage", async () => {
      const user = userEvent.setup()
      render(<InstructionStep step={step} index={0} recipeId="recipe-1" />)

      await user.click(screen.getByRole("button"))

      expect(sessionStorage.getItem("recipe-recipe-1-step-0")).toBe("true")
    })

    it("restores checked state from sessionStorage on mount", () => {
      sessionStorage.setItem("recipe-recipe-1-step-0", "true")

      render(<InstructionStep step={step} index={0} recipeId="recipe-1" />)

      expect(screen.getByRole("button")).toHaveAttribute("aria-label", "Step 1, completed")
    })
  })

  describe("posthog analytics", () => {
    it("does not throw when posthog is called", async () => {
      const user = userEvent.setup()
      render(<InstructionStep step={step} index={0} recipeId="recipe-1" />)
      await expect(user.click(screen.getByRole("button"))).resolves.not.toThrow()
    })
  })
})
