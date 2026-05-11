import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { render, screen, waitFor } from "../test/render"
import { IngredientSectionHeader } from "./IngredientSectionHeader"

describe("IngredientSectionHeader", () => {
  it("renders the section title", () => {
    render(<IngredientSectionHeader title="Drizzle sauce" recipeId="recipe-1" indices={[0, 1]} />)
    expect(screen.getByText("Drizzle sauce")).toBeInTheDocument()
  })

  it("renders as a button", () => {
    render(<IngredientSectionHeader title="Sauce" recipeId="recipe-1" indices={[2]} />)
    expect(screen.getByRole("button")).toBeInTheDocument()
  })

  it("does not show check icon when no ingredients are checked", () => {
    render(<IngredientSectionHeader title="Sauce" recipeId="recipe-1" indices={[0, 1]} />)
    expect(screen.queryByRole("img", { hidden: true })).not.toBeInTheDocument()
  })

  it("shows check icon after mount when all ingredients are checked in sessionStorage", async () => {
    sessionStorage.setItem("recipe-recipe-1-ingredient-0", "true")
    sessionStorage.setItem("recipe-recipe-1-ingredient-1", "true")

    render(<IngredientSectionHeader title="Sauce" recipeId="recipe-1" indices={[0, 1]} />)

    await waitFor(() => {
      expect(document.querySelector("svg")).toBeInTheDocument()
    })
  })

  it("toggles all ingredients to checked on click when none are checked", async () => {
    const user = userEvent.setup()
    render(<IngredientSectionHeader title="Sauce" recipeId="recipe-1" indices={[0, 1]} />)

    await user.click(screen.getByRole("button"))

    expect(sessionStorage.getItem("recipe-recipe-1-ingredient-0")).toBe("true")
    expect(sessionStorage.getItem("recipe-recipe-1-ingredient-1")).toBe("true")
  })

  it("toggles all ingredients to unchecked on click when all are checked", async () => {
    sessionStorage.setItem("recipe-recipe-1-ingredient-0", "true")
    sessionStorage.setItem("recipe-recipe-1-ingredient-1", "true")
    const user = userEvent.setup()
    render(<IngredientSectionHeader title="Sauce" recipeId="recipe-1" indices={[0, 1]} />)

    await waitFor(() => {
      expect(document.querySelector("svg")).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button"))

    expect(sessionStorage.getItem("recipe-recipe-1-ingredient-0")).toBe("false")
    expect(sessionStorage.getItem("recipe-recipe-1-ingredient-1")).toBe("false")
  })
})
