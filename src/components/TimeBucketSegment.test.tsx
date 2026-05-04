import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { TimeBucketSegment } from "./TimeBucketSegment"

describe("TimeBucketSegment", () => {
  it("renders all four time bucket options", () => {
    render(<TimeBucketSegment value={null} onChange={vi.fn()} />)
    expect(screen.getByRole("radio", { name: /under 30m/i })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: /30.60m/i })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: /1.2h/i })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: /2h\+/i })).toBeInTheDocument()
  })

  it("renders as a radiogroup with an accessible label", () => {
    render(<TimeBucketSegment value={null} onChange={vi.fn()} />)
    expect(screen.getByRole("radiogroup", { name: /total time/i })).toBeInTheDocument()
  })

  it("marks no option as checked when value is null", () => {
    render(<TimeBucketSegment value={null} onChange={vi.fn()} />)
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toHaveAttribute("aria-checked", "false")
    }
  })

  it("marks the active option as checked", () => {
    render(<TimeBucketSegment value="under30" onChange={vi.fn()} />)
    expect(screen.getByRole("radio", { name: /under 30m/i })).toHaveAttribute(
      "aria-checked",
      "true"
    )
    expect(screen.getByRole("radio", { name: /30.60m/i })).toHaveAttribute("aria-checked", "false")
  })

  it("calls onChange with the bucket value when an inactive option is clicked", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TimeBucketSegment value={null} onChange={onChange} />)
    await user.click(screen.getByRole("radio", { name: /1.2h/i }))
    expect(onChange).toHaveBeenCalledWith("60to120")
  })

  it("calls onChange with null when the active option is clicked (deselect)", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TimeBucketSegment value="under30" onChange={onChange} />)
    await user.click(screen.getByRole("radio", { name: /under 30m/i }))
    expect(onChange).toHaveBeenCalledWith(null)
  })
})
