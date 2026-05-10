import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import userEvent from "@testing-library/user-event"
import React from "react"
import { describe, expect, it, vi } from "vitest"
import * as sdk from "../api/generated/sdk.gen"
import type { RecipeSummary } from "../api/generated/types.gen"
import {
  RecipeCardInfoBadges,
  RecipeCardTimeBadge,
  RecipeCardToolBadges,
} from "../components/RecipeCardMeta"
import { render, screen } from "../test/render"
import { Route } from "./recipes.index"

vi.mock("../contexts/MotionPermissionContext", () => ({
  useMotionPermissionContext: vi.fn(() => ({ state: "granted", request: vi.fn() })),
  MotionPermissionProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock("../api/generated/sdk.gen", () => ({
  getAllApiRecipesGet: vi.fn(),
}))

vi.mock("../manaaki.svg?react", () => ({
  default: () => null,
}))

const baseRecipe: RecipeSummary = {
  id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  slug: "banana-bread",
  name: "Banana Bread",
}

describe("RecipeCardTimeBadge", () => {
  it("shows formatted time when totalTime is present", () => {
    render(<RecipeCardTimeBadge recipe={{ ...baseRecipe, totalTime: "30 minutes" }} />)
    expect(screen.getByText("30m")).toBeInTheDocument()
  })

  it("shows hours and minutes formatted compactly", () => {
    render(<RecipeCardTimeBadge recipe={{ ...baseRecipe, totalTime: "1 hour 15 minutes" }} />)
    expect(screen.getByText("1h 15m")).toBeInTheDocument()
  })

  it("shows freeform time strings as-is", () => {
    render(
      <RecipeCardTimeBadge
        recipe={{ ...baseRecipe, totalTime: "10 mins, plus 2 hrs marinating" }}
      />
    )
    expect(screen.getByText("10 mins, plus 2 hrs marinating")).toBeInTheDocument()
  })

  it("does not show time when totalTime is null", () => {
    const { container } = render(
      <RecipeCardTimeBadge recipe={{ ...baseRecipe, totalTime: null }} />
    )
    expect(container.firstChild).toBeNull()
  })

  it("does not show time when totalTime is 'none'", () => {
    const { container } = render(
      <RecipeCardTimeBadge recipe={{ ...baseRecipe, totalTime: "none" }} />
    )
    expect(container.firstChild).toBeNull()
  })
})

describe("RecipeCardInfoBadges", () => {
  it("does not show servings", () => {
    render(<RecipeCardInfoBadges recipe={{ ...baseRecipe, recipeServings: 4 }} />)
    expect(screen.queryByText(/serving/)).not.toBeInTheDocument()
  })

  it("shows star rating when present", () => {
    render(<RecipeCardInfoBadges recipe={{ ...baseRecipe, rating: 5 }} />)
    expect(screen.getByLabelText("5 out of 5 stars")).toBeInTheDocument()
  })

  it("does not show rating when rating is null", () => {
    const { container } = render(<RecipeCardInfoBadges recipe={{ ...baseRecipe, rating: null }} />)
    expect(container.firstChild).toBeNull()
  })

  it("does not render the recipe description", () => {
    render(
      <RecipeCardInfoBadges
        recipe={{ ...baseRecipe, description: "A lovely moist banana bread recipe." }}
      />
    )
    expect(screen.queryByText(/lovely moist/)).not.toBeInTheDocument()
  })
})

describe("RecipeCardToolBadges", () => {
  describe("slow cooker", () => {
    it("shows slow cooker badge when tools array contains 'Slow Cooker'", () => {
      render(
        <RecipeCardToolBadges
          recipe={{ ...baseRecipe, tools: [{ id: "1", name: "Slow Cooker", slug: "slow-cooker" }] }}
        />
      )
      expect(screen.getByText("Slow cooker")).toBeInTheDocument()
    })

    it("shows slow cooker badge when a tag matches", () => {
      render(
        <RecipeCardToolBadges
          recipe={{ ...baseRecipe, tags: [{ name: "Slow Cooker", slug: "slow-cooker" }] }}
        />
      )
      expect(screen.getByText("Slow cooker")).toBeInTheDocument()
    })

    it("shows slow cooker badge when a category matches", () => {
      render(
        <RecipeCardToolBadges
          recipe={{
            ...baseRecipe,
            recipeCategory: [{ name: "Slow Cooker Meals", slug: "slow-cooker-meals" }],
          }}
        />
      )
      expect(screen.getByText("Slow cooker")).toBeInTheDocument()
    })

    it("matches case-insensitively", () => {
      render(
        <RecipeCardToolBadges
          recipe={{ ...baseRecipe, tools: [{ id: "1", name: "slow cooker", slug: "slow-cooker" }] }}
        />
      )
      expect(screen.getByText("Slow cooker")).toBeInTheDocument()
    })
  })

  describe("air fryer", () => {
    it("shows air fryer badge when tools array contains 'Air Fryer'", () => {
      render(
        <RecipeCardToolBadges
          recipe={{ ...baseRecipe, tools: [{ id: "2", name: "Air Fryer", slug: "air-fryer" }] }}
        />
      )
      expect(screen.getByText("Air fryer")).toBeInTheDocument()
    })

    it("matches case-insensitively", () => {
      render(
        <RecipeCardToolBadges
          recipe={{ ...baseRecipe, tools: [{ id: "2", name: "air fryer", slug: "air-fryer" }] }}
        />
      )
      expect(screen.getByText("Air fryer")).toBeInTheDocument()
    })
  })

  it("shows multiple tool badges when multiple tools match", () => {
    render(
      <RecipeCardToolBadges
        recipe={{
          ...baseRecipe,
          tools: [
            { id: "1", name: "Slow Cooker", slug: "slow-cooker" },
            { id: "2", name: "Air Fryer", slug: "air-fryer" },
          ],
        }}
      />
    )
    expect(screen.getByText("Slow cooker")).toBeInTheDocument()
    expect(screen.getByText("Air fryer")).toBeInTheDocument()
  })

  it("renders nothing when no matching tools, tags or categories", () => {
    const { container } = render(
      <RecipeCardToolBadges
        recipe={{
          ...baseRecipe,
          tools: [{ id: "3", name: "Stand Mixer", slug: "stand-mixer" }],
          tags: [{ name: "Dinner", slug: "dinner" }],
        }}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it("renders nothing when tools, tags and categories are all empty", () => {
    const { container } = render(
      <RecipeCardToolBadges recipe={{ ...baseRecipe, tools: [], tags: [], recipeCategory: [] }} />
    )
    expect(container.firstChild).toBeNull()
  })
})

const mockGetAll = vi.mocked(sdk.getAllApiRecipesGet)

function RecipeListWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const RecipeList = Route.options.component as React.ComponentType
  return React.createElement(
    QueryClientProvider,
    { client: queryClient },
    React.createElement(RecipeList)
  )
}

describe("RecipeList loading state", () => {
  it("shows a loading status region while data is pending", () => {
    mockGetAll.mockReturnValue(new Promise(() => undefined) as any)
    render(<RecipeListWrapper />)
    expect(screen.getByRole("status", { name: /loading recipes/i })).toBeInTheDocument()
  })

  it("shows the Manaaki heading while loading", () => {
    mockGetAll.mockReturnValue(new Promise(() => undefined) as any)
    render(<RecipeListWrapper />)
    expect(screen.getByRole("heading", { name: /manaaki/i })).toBeInTheDocument()
  })

  it("shows an About Manaaki button", () => {
    mockGetAll.mockReturnValue(new Promise(() => undefined) as any)
    render(<RecipeListWrapper />)
    expect(screen.getByRole("button", { name: /about manaaki/i })).toBeInTheDocument()
  })

  it("opens the About modal when the Manaaki button is clicked", async () => {
    const user = userEvent.setup()
    mockGetAll.mockReturnValue(new Promise(() => undefined) as any)
    render(<RecipeListWrapper />)
    await user.click(screen.getByRole("button", { name: /about manaaki/i }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByText("About Manaaki")).toBeInTheDocument()
  })

  it("shows the search bar while loading", () => {
    mockGetAll.mockReturnValue(new Promise(() => undefined) as any)
    render(<RecipeListWrapper />)
    expect(screen.getByRole("searchbox", { name: /search recipes/i })).toBeInTheDocument()
  })

  it("does not show recipe count while loading", () => {
    mockGetAll.mockReturnValue(new Promise(() => undefined) as any)
    render(<RecipeListWrapper />)
    expect(screen.queryByText(/\d+ recipes/i)).not.toBeInTheDocument()
  })
})
