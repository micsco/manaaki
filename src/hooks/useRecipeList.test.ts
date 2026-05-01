import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import * as sdk from "../api/generated/sdk.gen"
import { useRecipeList } from "./useRecipeList"

vi.mock("../api/generated/sdk.gen", () => ({
  getAllApiRecipesGet: vi.fn(),
}))

const mockGetAll = vi.mocked(sdk.getAllApiRecipesGet)

function makeRecipe(slug: string) {
  return { id: slug, slug, name: slug }
}

function makePage(items: ReturnType<typeof makeRecipe>[], total_pages: number, page = 1) {
  return {
    data: { items, page, per_page: 50, total: items.length * total_pages, total_pages },
  }
}

function wrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

describe("useRecipeList", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns items from a single-page response", async () => {
    const recipes = [makeRecipe("apple-pie"), makeRecipe("banana-bread")]
    mockGetAll.mockResolvedValue(makePage(recipes, 1) as any)

    const { result } = renderHook(() => useRecipeList(), { wrapper: wrapper() })

    await waitFor(() => expect(result.current).toHaveLength(2))
    expect(result.current[0].slug).toBe("apple-pie")
    expect(result.current[1].slug).toBe("banana-bread")
    expect(mockGetAll).toHaveBeenCalledTimes(1)
  })

  it("fetches all pages in parallel and merges them in order", async () => {
    const page1 = [makeRecipe("recipe-1"), makeRecipe("recipe-2")]
    const page2 = [makeRecipe("recipe-3"), makeRecipe("recipe-4")]
    const page3 = [makeRecipe("recipe-5")]

    mockGetAll
      .mockResolvedValueOnce(makePage(page1, 3, 1) as any)
      .mockResolvedValueOnce(makePage(page2, 3, 2) as any)
      .mockResolvedValueOnce(makePage(page3, 3, 3) as any)

    const { result } = renderHook(() => useRecipeList(), { wrapper: wrapper() })

    await waitFor(() => expect(result.current).toHaveLength(5))
    expect(result.current.map(r => r.slug)).toEqual([
      "recipe-1",
      "recipe-2",
      "recipe-3",
      "recipe-4",
      "recipe-5",
    ])
    expect(mockGetAll).toHaveBeenCalledTimes(3)
  })

  it("requests page 1 first, then fetches remaining pages with correct page numbers", async () => {
    const page1 = [makeRecipe("a")]
    const page2 = [makeRecipe("b")]

    mockGetAll
      .mockResolvedValueOnce(makePage(page1, 2, 1) as any)
      .mockResolvedValueOnce(makePage(page2, 2, 2) as any)

    const { result } = renderHook(() => useRecipeList(), { wrapper: wrapper() })

    await waitFor(() => expect(result.current).toHaveLength(2))
    expect(mockGetAll).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ query: expect.objectContaining({ page: 1 }) })
    )
    expect(mockGetAll).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ query: expect.objectContaining({ page: 2 }) })
    )
  })

  it("returns an empty array while the query is loading", () => {
    mockGetAll.mockReturnValue(new Promise(_resolve => undefined) as any)

    const { result } = renderHook(() => useRecipeList(), { wrapper: wrapper() })

    expect(result.current).toEqual([])
  })

  it("throws when the API returns no data", async () => {
    mockGetAll.mockResolvedValue({ data: undefined } as any)

    const { result } = renderHook(() => useRecipeList(), { wrapper: wrapper() })

    await waitFor(() => expect(result.current).toEqual([]))
  })

  it("treats missing total_pages as a single page", async () => {
    const recipes = [makeRecipe("solo")]
    mockGetAll.mockResolvedValue({ data: { items: recipes, total_pages: undefined } } as any)

    const { result } = renderHook(() => useRecipeList(), { wrapper: wrapper() })

    await waitFor(() => expect(result.current).toHaveLength(1))
    expect(mockGetAll).toHaveBeenCalledTimes(1)
  })
})
