import { describe, expect, it, vi } from "vitest"

import { render, screen } from "../test/render"
import { RecipeNotes } from "./RecipeNotes"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: any) => (
    <a href={to} data-internal="true" {...props}>
      {children}
    </a>
  ),
}))

describe("RecipeNotes", () => {
  it("renders markdown links to other recipes inside the app", () => {
    render(
      <RecipeNotes
        notes={[
          {
            title: "Air fryer version",
            text: "See [BBQ Potatoes (Air Fryer)](https://manaaki.micsco.nz/recipes/3gtb-J0qQVehsjXA030-Cg/bbq).",
          },
        ]}
      />
    )
    const link = screen.getByRole("link", { name: "BBQ Potatoes (Air Fryer)" })
    expect(link).toHaveAttribute("href", "/recipes/3gtb-J0qQVehsjXA030-Cg/bbq")
    expect(link).toHaveAttribute("data-internal", "true")
  })

  it("opens other sites in a new tab and keeps formatting", () => {
    render(<RecipeNotes notes={[{ title: "", text: "**Tip:** buy at https://www.ocado.com" }]} />)
    expect(screen.getByText("Tip:").tagName).toBe("STRONG")
    const link = screen.getByRole("link", { name: "https://www.ocado.com" })
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noopener noreferrer")
  })

  it("shows HTML in notes as text instead of running it", () => {
    const { container } = render(
      <RecipeNotes notes={[{ title: "", text: "<img src=x onerror=alert(1)>" }]} />
    )
    expect(container.querySelector("img")).toBeNull()
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument()
  })
})
