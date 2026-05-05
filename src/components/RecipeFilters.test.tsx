import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { FilterBar, FilterPills } from "./RecipeFilters"

describe("FilterPills", () => {
  const defaultProps = {
    proteins: [],
    onToggleProtein: vi.fn(),
    tools: [],
    onToggleTool: vi.fn(),
  }

  it("renders all protein options as chips", () => {
    render(<FilterPills {...defaultProps} />)
    expect(screen.getByRole("button", { name: /chicken/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /beef/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /pork/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /fish/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /lamb/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /vegetarian/i })).toBeInTheDocument()
  })

  it("renders tool options as chips", () => {
    render(<FilterPills {...defaultProps} />)
    expect(screen.getByRole("button", { name: /slow cooker/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /air fryer/i })).toBeInTheDocument()
  })

  it("marks active protein chip as pressed", () => {
    render(<FilterPills {...defaultProps} proteins={["chicken"]} />)
    expect(screen.getByRole("button", { name: /chicken/i })).toHaveAttribute("aria-pressed", "true")
  })

  it("marks inactive chips as not pressed", () => {
    render(<FilterPills {...defaultProps} />)
    expect(screen.getByRole("button", { name: /chicken/i })).toHaveAttribute(
      "aria-pressed",
      "false"
    )
  })

  it("calls onToggleProtein when a protein chip is clicked", async () => {
    const user = userEvent.setup()
    const onToggleProtein = vi.fn()
    render(<FilterPills {...defaultProps} onToggleProtein={onToggleProtein} />)
    await user.click(screen.getByRole("button", { name: /chicken/i }))
    expect(onToggleProtein).toHaveBeenCalledWith("chicken")
  })

  it("calls onToggleTool when a tool chip is clicked", async () => {
    const user = userEvent.setup()
    const onToggleTool = vi.fn()
    render(<FilterPills {...defaultProps} onToggleTool={onToggleTool} />)
    await user.click(screen.getByRole("button", { name: /slow cooker/i }))
    expect(onToggleTool).toHaveBeenCalledWith("slow cooker")
  })
})

describe("FilterBar", () => {
  const defaultProps = {
    search: "",
    onSearchChange: vi.fn(),
    activeFilterCount: 0,
    onOpenDrawer: vi.fn(),
  }

  it("renders the search input", () => {
    render(<FilterBar {...defaultProps} />)
    expect(screen.getByRole("searchbox", { name: /search recipes/i })).toBeInTheDocument()
  })

  it("renders the filters button", () => {
    render(<FilterBar {...defaultProps} />)
    expect(screen.getByRole("button", { name: /filters/i })).toBeInTheDocument()
  })

  it("shows active filter count badge when filters are applied", () => {
    render(<FilterBar {...defaultProps} activeFilterCount={3} />)
    expect(screen.getByText("3")).toBeInTheDocument()
  })

  it("does not show active filter count badge when no filters are applied", () => {
    render(<FilterBar {...defaultProps} activeFilterCount={0} />)
    expect(screen.queryByText("0")).not.toBeInTheDocument()
  })

  it("calls onOpenDrawer when the filters button is clicked", async () => {
    const user = userEvent.setup()
    const onOpenDrawer = vi.fn()
    render(<FilterBar {...defaultProps} onOpenDrawer={onOpenDrawer} />)
    await user.click(screen.getByRole("button", { name: /filters/i }))
    expect(onOpenDrawer).toHaveBeenCalledOnce()
  })

  it("passes search value to the search input", () => {
    render(<FilterBar {...defaultProps} search="pasta" />)
    expect(screen.getByRole("searchbox")).toHaveValue("pasta")
  })
})
