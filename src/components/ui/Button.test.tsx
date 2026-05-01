import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { Button } from "./Button"

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Save</Button>)
    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument()
  })

  it("calls onClick when clicked", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Click me</Button>)

    await user.click(screen.getByRole("button", { name: /click me/i }))

    expect(onClick).toHaveBeenCalledOnce()
  })

  it("does not call onClick when disabled", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Disabled
      </Button>
    )

    await user.click(screen.getByRole("button", { name: /disabled/i }))

    expect(onClick).not.toHaveBeenCalled()
  })

  it("applies primary variant classes by default", () => {
    render(<Button>Primary</Button>)
    expect(screen.getByRole("button").className).toContain("bg-orange-600")
  })

  it("applies secondary variant classes", () => {
    render(<Button variant="secondary">Secondary</Button>)
    expect(screen.getByRole("button").className).toContain("bg-gray-800")
  })

  it("applies ghost variant classes", () => {
    render(<Button variant="ghost">Ghost</Button>)
    expect(screen.getByRole("button").className).toContain("text-gray-300")
  })

  it("applies sm size classes", () => {
    render(<Button size="sm">Small</Button>)
    expect(screen.getByRole("button").className).toContain("px-3")
  })

  it("applies lg size classes", () => {
    render(<Button size="lg">Large</Button>)
    expect(screen.getByRole("button").className).toContain("px-6")
  })

  it("merges additional className", () => {
    render(<Button className="my-class">Styled</Button>)
    expect(screen.getByRole("button").className).toContain("my-class")
  })
})
