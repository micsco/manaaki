import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { render, screen } from "../test/render"
import { CookModeToggle } from "./CookModeToggle"

describe("CookModeToggle", () => {
  it("shows 'Cook Mode' when cook mode is off", () => {
    render(<CookModeToggle />)
    expect(screen.getByRole("button", { name: /cook mode/i })).toBeInTheDocument()
  })

  it("shows 'Exit Cook Mode' after toggling on", async () => {
    const user = userEvent.setup()
    render(<CookModeToggle />)

    await user.click(screen.getByRole("button", { name: /cook mode/i }))

    expect(screen.getByRole("button", { name: /exit cook mode/i })).toBeInTheDocument()
  })

  it("returns to 'Cook Mode' after toggling twice", async () => {
    const user = userEvent.setup()
    render(<CookModeToggle />)

    await user.click(screen.getByRole("button", { name: /cook mode/i }))
    await user.click(screen.getByRole("button", { name: /exit cook mode/i }))

    expect(screen.getByRole("button", { name: /cook mode/i })).toBeInTheDocument()
  })

  it("applies active styles when cook mode is on", async () => {
    const user = userEvent.setup()
    render(<CookModeToggle />)

    await user.click(screen.getByRole("button", { name: /cook mode/i }))

    expect(screen.getByRole("button").className).toContain("bg-orange-600")
  })

  it("applies inactive styles when cook mode is off", () => {
    render(<CookModeToggle />)
    expect(screen.getByRole("button").className).toContain("bg-gray-800")
  })
})
