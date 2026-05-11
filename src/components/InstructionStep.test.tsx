import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import type { RecipeStep } from "../api/generated/types.gen"
import { render, screen, waitFor } from "../test/render"
import { InstructionStep } from "./InstructionStep"

const step: RecipeStep = { id: "step-1", text: "Boil the water.", title: null }
const stepWithSummary: RecipeStep = {
  id: "step-2",
  text: "Mix the sauce ingredients.",
  title: null,
  summary: "Drizzle sauce",
}
const stepWithEmptySummary: RecipeStep = {
  id: "step-3",
  text: "Toast the cashews.",
  title: null,
  summary: "   ",
}

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

  describe("summary field", () => {
    it("renders the summary in bold before the step text", () => {
      render(<InstructionStep step={stepWithSummary} index={0} recipeId="recipe-1" />)
      const strong = screen.getByText("Drizzle sauce")
      expect(strong.tagName).toBe("STRONG")
      expect(strong.closest("span")?.textContent).toContain("Mix the sauce ingredients.")
    })

    it("renders an em-dash separator between summary and text", () => {
      render(<InstructionStep step={stepWithSummary} index={0} recipeId="recipe-1" />)
      const textSpan = screen.getByText("Drizzle sauce").closest("span")
      expect(textSpan?.textContent).toContain(" — ")
    })

    it("does not render a summary prefix when summary is absent", () => {
      render(<InstructionStep step={step} index={0} recipeId="recipe-1" />)
      expect(screen.queryByText(/ — /)).not.toBeInTheDocument()
    })

    it("does not render a summary prefix when summary is whitespace only", () => {
      render(<InstructionStep step={stepWithEmptySummary} index={0} recipeId="recipe-1" />)
      expect(screen.queryByText(/ — /)).not.toBeInTheDocument()
    })

    it("includes summary in aria-label when present", () => {
      render(<InstructionStep step={stepWithSummary} index={1} recipeId="recipe-1" />)
      expect(screen.getByRole("button")).toHaveAttribute("aria-label", "Step 2: Drizzle sauce")
    })

    it("includes summary in aria-label when completed", async () => {
      const user = userEvent.setup()
      render(<InstructionStep step={stepWithSummary} index={1} recipeId="recipe-1" />)

      await user.click(screen.getByRole("button"))

      expect(screen.getByRole("button")).toHaveAttribute(
        "aria-label",
        "Step 2: Drizzle sauce, completed"
      )
    })

    it("does not include summary in aria-label when summary is whitespace only", () => {
      render(<InstructionStep step={stepWithEmptySummary} index={0} recipeId="recipe-1" />)
      expect(screen.getByRole("button")).toHaveAttribute("aria-label", "Step 1")
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

    it("restores checked state from sessionStorage after mount", async () => {
      sessionStorage.setItem("recipe-recipe-1-step-0", "true")

      render(<InstructionStep step={step} index={0} recipeId="recipe-1" />)

      await waitFor(() => {
        expect(screen.getByRole("button")).toHaveAttribute("aria-label", "Step 1, completed")
      })
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
