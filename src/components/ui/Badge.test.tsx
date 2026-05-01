import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Badge } from "./Badge"

describe("Badge", () => {
  it("renders children", () => {
    render(<Badge>Dinner</Badge>)
    expect(screen.getByText("Dinner")).toBeInTheDocument()
  })

  it("defaults to tag variant", () => {
    render(<Badge>Tag</Badge>)
    const badge = screen.getByText("Tag")
    expect(badge.className).toContain("bg-gray-800")
  })

  it("applies category variant classes", () => {
    render(<Badge variant="category">Category</Badge>)
    const badge = screen.getByText("Category")
    expect(badge.className).toContain("bg-orange-900")
  })

  it("applies rating variant classes", () => {
    render(<Badge variant="rating">5 stars</Badge>)
    const badge = screen.getByText("5 stars")
    expect(badge.className).toContain("bg-yellow-900")
  })

  it("merges additional className", () => {
    render(<Badge className="custom-class">Label</Badge>)
    expect(screen.getByText("Label").className).toContain("custom-class")
  })
})
