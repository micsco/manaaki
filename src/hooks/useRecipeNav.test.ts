import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import * as useRecipeListModule from "./useRecipeList"
import { useRecipeNav } from "./useRecipeNav"

const mockRecipes = [
  { id: "1", slug: "apple-pie", name: "Apple Pie" },
  { id: "2", slug: "banana-bread", name: "Banana Bread" },
  { id: "3", slug: "carrot-cake", name: "Carrot Cake" },
]

vi.mock("./useRecipeList", () => ({
  useRecipeList: vi.fn(),
}))

const mockUseRecipeList = vi.mocked(useRecipeListModule.useRecipeList)

describe("useRecipeNav", () => {
  it("returns prev and next for a middle recipe", () => {
    mockUseRecipeList.mockReturnValue(mockRecipes as any)
    const { result } = renderHook(() => useRecipeNav("banana-bread"))
    expect(result.current.prevSlug).toBe("apple-pie")
    expect(result.current.nextSlug).toBe("carrot-cake")
  })

  it("wraps around from the first recipe to the last", () => {
    mockUseRecipeList.mockReturnValue(mockRecipes as any)
    const { result } = renderHook(() => useRecipeNav("apple-pie"))
    expect(result.current.prevSlug).toBe("carrot-cake")
    expect(result.current.nextSlug).toBe("banana-bread")
  })

  it("wraps around from the last recipe to the first", () => {
    mockUseRecipeList.mockReturnValue(mockRecipes as any)
    const { result } = renderHook(() => useRecipeNav("carrot-cake"))
    expect(result.current.prevSlug).toBe("banana-bread")
    expect(result.current.nextSlug).toBe("apple-pie")
  })

  it("returns null for both when the list is empty", () => {
    mockUseRecipeList.mockReturnValue([])
    const { result } = renderHook(() => useRecipeNav("apple-pie"))
    expect(result.current.prevSlug).toBeNull()
    expect(result.current.nextSlug).toBeNull()
  })

  it("returns null for both when the slug is not in the list", () => {
    mockUseRecipeList.mockReturnValue(mockRecipes as any)
    const { result } = renderHook(() => useRecipeNav("not-a-recipe"))
    expect(result.current.prevSlug).toBeNull()
    expect(result.current.nextSlug).toBeNull()
  })

  it("wraps to itself when there is only one recipe", () => {
    mockUseRecipeList.mockReturnValue([{ id: "1", slug: "apple-pie", name: "Apple Pie" }] as any)
    const { result } = renderHook(() => useRecipeNav("apple-pie"))
    expect(result.current.prevSlug).toBe("apple-pie")
    expect(result.current.nextSlug).toBe("apple-pie")
  })
})
