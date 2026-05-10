import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { render, screen, waitFor } from "../test/render"
import { InstructionSectionHeader } from "./InstructionSectionHeader"

describe("InstructionSectionHeader", () => {
  it("renders the section title", () => {
    render(<InstructionSectionHeader title="Prep" recipeId="recipe-1" indices={[0, 1]} />)
    expect(screen.getByText("Prep")).toBeInTheDocument()
  })

  it("renders as a button", () => {
    render(<InstructionSectionHeader title="Sauce" recipeId="recipe-1" indices={[2]} />)
    expect(screen.getByRole("button")).toBeInTheDocument()
  })

  it("does not show check icon when no steps are completed", () => {
    render(<InstructionSectionHeader title="Prep" recipeId="recipe-1" indices={[0, 1]} />)
    expect(screen.queryByRole("img", { hidden: true })).not.toBeInTheDocument()
  })

  it("shows check icon after mount when all steps are completed in sessionStorage", async () => {
    sessionStorage.setItem("recipe-recipe-1-step-0", "true")
    sessionStorage.setItem("recipe-recipe-1-step-1", "true")

    render(<InstructionSectionHeader title="Prep" recipeId="recipe-1" indices={[0, 1]} />)

    await waitFor(() => {
      expect(document.querySelector("svg")).toBeInTheDocument()
    })
  })

  it("toggles all steps to complete on click when none are checked", async () => {
    const user = userEvent.setup()
    render(<InstructionSectionHeader title="Prep" recipeId="recipe-1" indices={[0, 1]} />)

    await user.click(screen.getByRole("button"))

    expect(sessionStorage.getItem("recipe-recipe-1-step-0")).toBe("true")
    expect(sessionStorage.getItem("recipe-recipe-1-step-1")).toBe("true")
  })

  it("toggles all steps to uncomplete on click when all are checked", async () => {
    sessionStorage.setItem("recipe-recipe-1-step-0", "true")
    sessionStorage.setItem("recipe-recipe-1-step-1", "true")
    const user = userEvent.setup()
    render(<InstructionSectionHeader title="Prep" recipeId="recipe-1" indices={[0, 1]} />)

    await waitFor(() => {
      expect(document.querySelector("svg")).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button"))

    expect(sessionStorage.getItem("recipe-recipe-1-step-0")).toBe("false")
    expect(sessionStorage.getItem("recipe-recipe-1-step-1")).toBe("false")
  })
})
