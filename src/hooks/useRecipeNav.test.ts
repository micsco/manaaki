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
    const { result } = renderHook(() => useRecipeNav("2"))
    expect(result.current.prevRecipe?.slug).toBe("apple-pie")
    expect(result.current.nextRecipe?.slug).toBe("carrot-cake")
  })

  it("wraps around from the first recipe to the last", () => {
    mockUseRecipeList.mockReturnValue(mockRecipes as any)
    const { result } = renderHook(() => useRecipeNav("1"))
    expect(result.current.prevRecipe?.slug).toBe("carrot-cake")
    expect(result.current.nextRecipe?.slug).toBe("banana-bread")
  })

  it("wraps around from the last recipe to the first", () => {
    mockUseRecipeList.mockReturnValue(mockRecipes as any)
    const { result } = renderHook(() => useRecipeNav("3"))
    expect(result.current.prevRecipe?.slug).toBe("banana-bread")
    expect(result.current.nextRecipe?.slug).toBe("apple-pie")
  })

  it("returns null for both when the list is empty", () => {
    mockUseRecipeList.mockReturnValue([])
    const { result } = renderHook(() => useRecipeNav("1"))
    expect(result.current.prevRecipe).toBeNull()
    expect(result.current.nextRecipe).toBeNull()
  })

  it("returns null for both when the id is not in the list", () => {
    mockUseRecipeList.mockReturnValue(mockRecipes as any)
    const { result } = renderHook(() => useRecipeNav("999"))
    expect(result.current.prevRecipe).toBeNull()
    expect(result.current.nextRecipe).toBeNull()
  })

  it("wraps to itself when there is only one recipe", () => {
    mockUseRecipeList.mockReturnValue([{ id: "1", slug: "apple-pie", name: "Apple Pie" }] as any)
    const { result } = renderHook(() => useRecipeNav("1"))
    expect(result.current.prevRecipe?.slug).toBe("apple-pie")
    expect(result.current.nextRecipe?.slug).toBe("apple-pie")
  })
})
