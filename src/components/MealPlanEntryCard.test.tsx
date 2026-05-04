import { describe, expect, it, vi } from "vitest"
import type { ReadPlanEntry } from "../api/generated/types.gen"
import { render, screen } from "../test/render"
import { entryTitle, MealPlanEntryCard } from "./MealPlanEntryCard"

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

describe("entryTitle", () => {
  it("returns recipe name when recipe is present", () => {
    expect(entryTitle(makeEntry({ recipe: { name: "Pasta" } as any }))).toBe("Pasta")
  })

  it("falls back to title when no recipe", () => {
    expect(entryTitle(makeEntry({ title: "Leftovers" }))).toBe("Leftovers")
  })

  it("falls back to text when no title or recipe", () => {
    expect(entryTitle(makeEntry({ text: "Something quick" }))).toBe("Something quick")
  })

  it("falls back to 'Meal' when nothing is set", () => {
    expect(entryTitle(makeEntry())).toBe("Meal")
  })
})

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

  it("renders entry type label in eyebrow when entryType is set", () => {
    const entry = makeEntry({ entryType: "dinner" })
    render(<MealPlanEntryCard entry={entry} />)
    expect(screen.getByText(/Dinner/)).toBeInTheDocument()
  })

  it("renders dayLabel in eyebrow when provided", () => {
    const entry = makeEntry({ entryType: "dinner" })
    render(<MealPlanEntryCard entry={entry} dayLabel="Tomorrow" />)
    expect(screen.getByText(/Tomorrow/)).toBeInTheDocument()
    expect(screen.getByText(/Dinner/)).toBeInTheDocument()
  })

  it("renders cook time when recipe has totalTime", () => {
    const entry = makeEntry({
      recipe: {
        id: "550e8400-e29b-41d4-a716-446655440000",
        slug: "pasta",
        name: "Pasta",
        totalTime: "35 minutes",
      } as any,
    })
    render(<MealPlanEntryCard entry={entry} />)
    expect(screen.getByText("35m")).toBeInTheDocument()
  })

  it("renders a link when the entry has a recipe with id and slug", () => {
    const entry = makeEntry({
      recipe: {
        id: "550e8400-e29b-41d4-a716-446655440000",
        slug: "pasta",
        name: "Pasta",
      } as any,
    })
    render(<MealPlanEntryCard entry={entry} />)
    expect(screen.getByRole("link")).toBeInTheDocument()
  })

  it("does not render a link when there is no recipe", () => {
    const entry = makeEntry({ title: "Free text meal" })
    render(<MealPlanEntryCard entry={entry} />)
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })
})
