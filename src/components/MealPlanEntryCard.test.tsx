import { describe, expect, it, vi } from "vitest"
import type { ReadPlanEntry } from "../api/generated/types.gen"
import { render, screen } from "../test/render"
import { MealPlanEntryCard } from "./MealPlanEntryCard"

vi.mock("@tanstack/react-router", async importOriginal => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>()
  return {
    ...actual,
    Link: ({ to, children, ...props }: any) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  }
})

function makeEntry(overrides: Partial<ReadPlanEntry> = {}): ReadPlanEntry {
  return {
    id: 1,
    date: "2024-02-25",
    groupId: "group-1",
    userId: "user-1",
    householdId: "household-1",
    ...overrides,
  }
}

describe("MealPlanEntryCard", () => {
  it("renders the recipe name when a recipe is attached", () => {
    const entry = makeEntry({
      recipe: {
        id: "550e8400-e29b-41d4-a716-446655440000",
        slug: "pasta",
        name: "Pasta Bake",
      } as any,
    })
    render(<MealPlanEntryCard entry={entry} />)
    expect(screen.getByText("Pasta Bake")).toBeInTheDocument()
  })

  it("falls back to entry title when no recipe is attached", () => {
    const entry = makeEntry({ title: "Leftovers" })
    render(<MealPlanEntryCard entry={entry} />)
    expect(screen.getByText("Leftovers")).toBeInTheDocument()
  })

  it("falls back to entry text when no title or recipe", () => {
    const entry = makeEntry({ text: "Something quick" })
    render(<MealPlanEntryCard entry={entry} />)
    expect(screen.getByText("Something quick")).toBeInTheDocument()
  })

  it("falls back to 'Meal' when no name, title, or text", () => {
    render(<MealPlanEntryCard entry={makeEntry()} />)
    expect(screen.getByText("Meal")).toBeInTheDocument()
  })

  it("renders entry type badge when entryType is set", () => {
    const entry = makeEntry({ entryType: "dinner" })
    render(<MealPlanEntryCard entry={entry} />)
    expect(screen.getByText("dinner")).toBeInTheDocument()
  })

  it("renders a link when the entry has a recipe with id and slug", () => {
    const entry = makeEntry({
      recipe: { id: "550e8400-e29b-41d4-a716-446655440000", slug: "pasta", name: "Pasta" } as any,
    })
    render(<MealPlanEntryCard entry={entry} />)
    const link = screen.getByRole("link")
    expect(link).toBeInTheDocument()
  })

  it("does not render a link when there is no recipe", () => {
    const entry = makeEntry({ title: "Free text meal" })
    render(<MealPlanEntryCard entry={entry} />)
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })
})
