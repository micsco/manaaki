import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { StarRating } from "./StarRating"

describe("StarRating", () => {
  it("renders 5 stars by default", () => {
    const { container } = render(<StarRating rating={3} />)
    const icons = container.querySelectorAll("svg")
    expect(icons).toHaveLength(5)
  })

  it("sets accessible label with rating and max", () => {
    render(<StarRating rating={4} />)
    expect(screen.getByLabelText("4 out of 5 stars")).toBeInTheDocument()
  })

  it("renders all full stars for a perfect rating", () => {
    const { container } = render(<StarRating rating={5} />)
    const yellowIcons = container.querySelectorAll(".text-yellow-400")
    const dimIcons = container.querySelectorAll(".text-white\\/30")
    expect(yellowIcons).toHaveLength(5)
    expect(dimIcons).toHaveLength(0)
  })

  it("renders all empty stars for a zero rating", () => {
    const { container } = render(<StarRating rating={0} />)
    const yellowIcons = container.querySelectorAll(".text-yellow-400")
    const dimIcons = container.querySelectorAll(".text-white\\/30")
    expect(yellowIcons).toHaveLength(0)
    expect(dimIcons).toHaveLength(5)
  })

  it("renders a half star for a 0.5 value", () => {
    render(<StarRating rating={0.5} />)
    expect(screen.getByLabelText("0.5 out of 5 stars")).toBeInTheDocument()
  })

  it("treats values >= 0.75 as full and < 0.25 as empty", () => {
    const { container: c1 } = render(<StarRating rating={0.75} />)
    expect(c1.querySelectorAll(".text-yellow-400")).toHaveLength(1)

    const { container: c2 } = render(<StarRating rating={0.24} />)
    expect(c2.querySelectorAll(".text-white\\/30")).toHaveLength(5)
  })

  it("respects a custom max", () => {
    const { container } = render(<StarRating rating={3} max={3} />)
    const icons = container.querySelectorAll("svg")
    expect(icons).toHaveLength(3)
    expect(screen.getByLabelText("3 out of 3 stars")).toBeInTheDocument()
  })
})
