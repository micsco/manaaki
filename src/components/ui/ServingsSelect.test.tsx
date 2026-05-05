import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { ServingsSelect } from "./ServingsSelect"

describe("ServingsSelect", () => {
  it("renders the trigger button with the current value", () => {
    render(<ServingsSelect value={4} defaultServings={4} onChange={vi.fn()} />)
    expect(screen.getByRole("combobox", { name: /servings/i })).toBeInTheDocument()
    expect(screen.getByText("4")).toBeInTheDocument()
  })

  it("shows the servings label text", () => {
    render(<ServingsSelect value={2} defaultServings={4} onChange={vi.fn()} />)
    expect(screen.getByText(/servings/i)).toBeInTheDocument()
  })

  it("opens the dropdown when the trigger is clicked", async () => {
    const user = userEvent.setup()
    render(<ServingsSelect value={4} defaultServings={4} onChange={vi.fn()} />)

    await user.click(screen.getByRole("combobox", { name: /servings/i }))

    expect(await screen.findByRole("listbox")).toBeInTheDocument()
  })

  it("renders all 10 options when open", async () => {
    const user = userEvent.setup()
    render(<ServingsSelect value={1} defaultServings={4} onChange={vi.fn()} />)

    await user.click(screen.getByRole("combobox", { name: /servings/i }))
    await screen.findByRole("listbox")

    const options = screen.getAllByRole("option")
    expect(options).toHaveLength(10)
  })

  it("shows 'original' label next to the recipe default serving count", async () => {
    const user = userEvent.setup()
    render(<ServingsSelect value={1} defaultServings={4} onChange={vi.fn()} />)

    await user.click(screen.getByRole("combobox", { name: /servings/i }))
    await screen.findByRole("listbox")

    expect(screen.getByText("original")).toBeInTheDocument()
  })

  it("calls onChange with the selected number when an option is clicked", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ServingsSelect value={2} defaultServings={4} onChange={onChange} />)

    await user.click(screen.getByRole("combobox", { name: /servings/i }))
    await screen.findByRole("listbox")
    await user.click(screen.getByRole("option", { name: "6" }))

    expect(onChange).toHaveBeenCalledWith(6, expect.anything())
  })
})
