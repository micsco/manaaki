import userEvent from "@testing-library/user-event"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { describe, expect, it } from "vitest"
import type { RecipeIngredientOutput, RecipeStep } from "../api/generated/types.gen"
import { CookModeProvider } from "../contexts/CookModeContext"
import { render, screen } from "../test/render"
import { RecipeTabsMobile } from "./RecipeTabsMobile"

const ingredients: RecipeIngredientOutput[] = [
  {
    display: "200g pasta",
    originalText: "200g pasta",
    quantity: 200,
    food: { name: "pasta" },
    unit: null,
    note: null,
    title: null,
  },
]

const instructions: RecipeStep[] = [{ id: "step-1", text: "Boil water.", title: null }]

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NuqsTestingAdapter>
      <CookModeProvider>{children}</CookModeProvider>
    </NuqsTestingAdapter>
  )
}

describe("RecipeTabsMobile", () => {
  it("renders Ingredients and Method tabs", () => {
    render(
      <Wrapper>
        <RecipeTabsMobile ingredients={ingredients} instructions={instructions} recipeId="r1" />
      </Wrapper>
    )
    expect(screen.getByRole("tab", { name: /ingredients/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /method/i })).toBeInTheDocument()
  })

  it("does not render the Description tab when no description is provided", () => {
    render(
      <Wrapper>
        <RecipeTabsMobile ingredients={ingredients} instructions={instructions} recipeId="r1" />
      </Wrapper>
    )
    expect(screen.queryByRole("tab", { name: /description/i })).not.toBeInTheDocument()
  })

  it("renders the Description tab when a description is provided", () => {
    render(
      <Wrapper>
        <RecipeTabsMobile
          ingredients={ingredients}
          instructions={instructions}
          description="A tasty dish."
          recipeId="r1"
        />
      </Wrapper>
    )
    expect(screen.getByRole("tab", { name: /description/i })).toBeInTheDocument()
  })

  it("Ingredients tab is active by default", () => {
    render(
      <Wrapper>
        <RecipeTabsMobile ingredients={ingredients} instructions={instructions} recipeId="r1" />
      </Wrapper>
    )
    expect(screen.getByRole("tab", { name: /ingredients/i })).toHaveAttribute(
      "aria-selected",
      "true"
    )
  })

  it("switches to Method tab when clicked", async () => {
    const user = userEvent.setup()
    render(
      <Wrapper>
        <RecipeTabsMobile ingredients={ingredients} instructions={instructions} recipeId="r1" />
      </Wrapper>
    )
    await user.click(screen.getByRole("tab", { name: /method/i }))
    expect(screen.getByRole("tab", { name: /method/i })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("tab", { name: /ingredients/i })).toHaveAttribute(
      "aria-selected",
      "false"
    )
  })

  it("shows the description text in the Description tab when active", async () => {
    const user = userEvent.setup()
    render(
      <Wrapper>
        <RecipeTabsMobile
          ingredients={ingredients}
          instructions={instructions}
          description="A wonderful recipe for pasta lovers."
          recipeId="r1"
        />
      </Wrapper>
    )
    await user.click(screen.getByRole("tab", { name: /description/i }))
    expect(screen.getByText("A wonderful recipe for pasta lovers.")).toBeInTheDocument()
  })

  it("has a tablist with an accessible label", () => {
    render(
      <Wrapper>
        <RecipeTabsMobile ingredients={ingredients} instructions={instructions} recipeId="r1" />
      </Wrapper>
    )
    expect(screen.getByRole("tablist", { name: /recipe sections/i })).toBeInTheDocument()
  })
})
