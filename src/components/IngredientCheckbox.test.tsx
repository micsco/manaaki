import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { render, screen } from "../test/render"
import { IngredientCheckbox } from "./IngredientCheckbox"

const defaultProps = {
  ingredient: "2 cups flour",
  recipeId: "test-recipe",
  ingredientIndex: 0,
}

describe("IngredientCheckbox", () => {
  describe("rendering", () => {
    it("renders the ingredient text", () => {
      render(<IngredientCheckbox {...defaultProps} />)
      expect(screen.getByText("2 cups flour")).toBeInTheDocument()
    })

    it("renders a button", () => {
      render(<IngredientCheckbox {...defaultProps} />)
      expect(screen.getByRole("button", { name: /2 cups flour/i })).toBeInTheDocument()
    })

    it("starts unchecked", () => {
      render(<IngredientCheckbox {...defaultProps} />)
      expect(screen.getByRole("button").getAttribute("aria-label")).not.toMatch(/checked/)
    })

    it("renders structured ingredient: food name", () => {
      render(<IngredientCheckbox {...defaultProps} food={{ name: "flour" }} quantity={2} />)
      expect(screen.getByText("flour")).toBeInTheDocument()
    })

    it("renders structured ingredient: formatted quantity", () => {
      render(<IngredientCheckbox {...defaultProps} food={{ name: "butter" }} quantity={0.5} />)
      expect(screen.getByText("½")).toBeInTheDocument()
    })

    it("renders structured ingredient: note", () => {
      render(<IngredientCheckbox {...defaultProps} food={{ name: "cream" }} note="softened" />)
      expect(screen.getByText("softened")).toBeInTheDocument()
    })
  })

  describe("toggle behaviour", () => {
    it("marks as checked when clicked", async () => {
      const user = userEvent.setup()
      render(<IngredientCheckbox {...defaultProps} />)

      await user.click(screen.getByRole("button"))

      expect(screen.getByRole("button").getAttribute("aria-label")).toMatch(/checked/)
    })

    it("unchecks when clicked a second time", async () => {
      const user = userEvent.setup()
      render(<IngredientCheckbox {...defaultProps} />)

      await user.click(screen.getByRole("button"))
      await user.click(screen.getByRole("button"))

      expect(screen.getByRole("button").getAttribute("aria-label")).not.toMatch(/checked/)
    })

    it("toggles when the ingredient text is clicked", async () => {
      const user = userEvent.setup()
      render(<IngredientCheckbox {...defaultProps} />)

      await user.click(screen.getByText("2 cups flour"))

      expect(screen.getByRole("button").getAttribute("aria-label")).toMatch(/checked/)
    })
  })

  describe("session storage persistence", () => {
    it("persists checked state to sessionStorage", async () => {
      const user = userEvent.setup()
      render(<IngredientCheckbox {...defaultProps} />)

      await user.click(screen.getByRole("button"))

      expect(sessionStorage.getItem("recipe-test-recipe-ingredient-0")).toBe("true")
    })

    it("restores checked state from sessionStorage on mount", () => {
      sessionStorage.setItem("recipe-test-recipe-ingredient-0", "true")

      render(<IngredientCheckbox {...defaultProps} />)

      expect(screen.getByRole("button").getAttribute("aria-label")).toMatch(/checked/)
    })

    it("uses unique storage keys per ingredient index", async () => {
      const user = userEvent.setup()
      render(
        <>
          <IngredientCheckbox {...defaultProps} ingredientIndex={0} />
          <IngredientCheckbox {...defaultProps} ingredientIndex={1} ingredient="1 egg" />
        </>
      )

      const buttons = screen.getAllByRole("button")
      await user.click(buttons[0])

      expect(sessionStorage.getItem("recipe-test-recipe-ingredient-0")).toBe("true")
      expect(sessionStorage.getItem("recipe-test-recipe-ingredient-1")).toBeNull()
    })
  })
})
