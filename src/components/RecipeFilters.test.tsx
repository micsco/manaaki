import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { FilterBar, FilterPills, QuickFilters, SearchBar } from "./RecipeFilters"

describe("SearchBar", () => {
  it("renders with empty value", () => {
    render(<SearchBar value="" onChange={vi.fn()} />)
    expect(screen.getByRole("searchbox", { name: /search recipes/i })).toBeInTheDocument()
  })

  it("calls onChange when the user types", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SearchBar value="" onChange={onChange} />)
    await user.type(screen.getByRole("searchbox"), "chicken")
    expect(onChange).toHaveBeenCalled()
  })

  it("shows a clear button when value is non-empty", () => {
    render(<SearchBar value="pasta" onChange={vi.fn()} />)
    expect(screen.getByRole("button", { name: /clear search/i })).toBeInTheDocument()
  })

  it("does not show clear button when value is empty", () => {
    render(<SearchBar value="" onChange={vi.fn()} />)
    expect(screen.queryByRole("button", { name: /clear search/i })).not.toBeInTheDocument()
  })

  it("calls onChange with empty string when clear button is clicked", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SearchBar value="pasta" onChange={onChange} />)
    await user.click(screen.getByRole("button", { name: /clear search/i }))
    expect(onChange).toHaveBeenCalledWith("")
  })
})

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

describe("QuickFilters", () => {
  const defaultProps = {
    proteins: [],
    onToggleProtein: vi.fn(),
    tools: [],
    onToggleTool: vi.fn(),
    time: null,
    onSetTime: vi.fn(),
    activeFilterCount: 0,
    onOpenDrawer: vi.fn(),
  }

  it("renders all protein options as chips", () => {
    render(<QuickFilters {...defaultProps} />)
    expect(screen.getByRole("button", { name: /chicken/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /beef/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /pork/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /fish/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /lamb/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /vegetarian/i })).toBeInTheDocument()
  })

  it("renders tool options as chips", () => {
    render(<QuickFilters {...defaultProps} />)
    expect(screen.getByRole("button", { name: /slow cooker/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /air fryer/i })).toBeInTheDocument()
  })

  it("shows filter button", () => {
    render(<QuickFilters {...defaultProps} />)
    expect(screen.getByRole("button", { name: /filters/i })).toBeInTheDocument()
  })

  it("marks active protein chip as pressed", () => {
    render(<QuickFilters {...defaultProps} proteins={["chicken"]} />)
    expect(screen.getByRole("button", { name: /chicken/i })).toHaveAttribute("aria-pressed", "true")
  })

  it("marks inactive chips as not pressed", () => {
    render(<QuickFilters {...defaultProps} />)
    expect(screen.getByRole("button", { name: /chicken/i })).toHaveAttribute(
      "aria-pressed",
      "false"
    )
  })

  it("calls onToggleProtein when a protein chip is clicked", async () => {
    const user = userEvent.setup()
    const onToggleProtein = vi.fn()
    render(<QuickFilters {...defaultProps} onToggleProtein={onToggleProtein} />)
    await user.click(screen.getByRole("button", { name: /chicken/i }))
    expect(onToggleProtein).toHaveBeenCalledWith("chicken")
  })

  it("calls onToggleTool when a tool chip is clicked", async () => {
    const user = userEvent.setup()
    const onToggleTool = vi.fn()
    render(<QuickFilters {...defaultProps} onToggleTool={onToggleTool} />)
    await user.click(screen.getByRole("button", { name: /slow cooker/i }))
    expect(onToggleTool).toHaveBeenCalledWith("slow cooker")
  })

  it("calls onOpenDrawer when the filters button is clicked", async () => {
    const user = userEvent.setup()
    const onOpenDrawer = vi.fn()
    render(<QuickFilters {...defaultProps} onOpenDrawer={onOpenDrawer} />)
    await user.click(screen.getByRole("button", { name: /filters/i }))
    expect(onOpenDrawer).toHaveBeenCalledOnce()
  })

  it("shows active filter count badge when filters are applied", () => {
    render(<QuickFilters {...defaultProps} activeFilterCount={3} />)
    expect(screen.getByText("3")).toBeInTheDocument()
  })

  it("does not show active filter count badge when no filters are applied", () => {
    render(<QuickFilters {...defaultProps} activeFilterCount={0} />)
    expect(screen.queryByText("0")).not.toBeInTheDocument()
  })
})
