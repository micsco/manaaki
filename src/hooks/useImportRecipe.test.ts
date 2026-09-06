import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook } from "@testing-library/react"
import React from "react"
import { describe, expect, it, vi } from "vitest"

import * as sdk from "../api/generated/sdk.gen"
import { parseRecipeIngredients } from "../api/recipeParsing"
import { toastManager } from "../lib/toastManager"
import { extractErrorMessage, useImportRecipe } from "./useImportRecipe"

vi.mock("../api/generated/sdk.gen", () => ({
  parseRecipeUrlApiRecipesCreateUrlPost: vi.fn(),
}))

vi.mock("../api/recipeParsing", () => ({ parseRecipeIngredients: vi.fn() }))
vi.mock("../lib/toastManager", () => ({ toastManager: { add: vi.fn() } }))

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  return { queryClient, wrapper }
}

describe("extractErrorMessage", () => {
  it("returns plain string errors", () => {
    expect(extractErrorMessage("Network error")).toBe("Network error")
  })

  it("handles detail string errors", () => {
    expect(extractErrorMessage({ detail: "Recipe already exists" })).toBe("Recipe already exists")
  })

  it("translates credentials error to user-friendly message", () => {
    expect(extractErrorMessage({ detail: "Could not validate credentials" })).toBe(
      "You do not have permission to import recipes. Please sign in."
    )
  })

  it("translates HTTPException detail message to user-friendly message", () => {
    expect(extractErrorMessage({ detail: { message: "HTTPException", error: true } })).toBe(
      "Unable to scrape recipe from this URL. Please verify the link and try again."
    )
  })

  it("extracts custom nested message if available", () => {
    expect(extractErrorMessage({ detail: { message: "Site blocked scraper" } })).toBe(
      "Site blocked scraper"
    )
  })

  it("joins array of validation messages", () => {
    expect(
      extractErrorMessage({
        detail: [{ msg: "Invalid URL" }, { msg: "Missing schema" }],
      })
    ).toBe("Invalid URL, Missing schema")
  })

  it("returns fallback message for unknown error formats", () => {
    expect(extractErrorMessage({})).toBe(
      "Unable to scrape recipe from this URL. Please verify the link and try again."
    )
    expect(extractErrorMessage(null)).toBe(
      "Unable to scrape recipe from this URL. Please verify the link and try again."
    )
  })
})

describe("useImportRecipe", () => {
  it("successfully imports a recipe and invalidates the recipe query cache", async () => {
    vi.mocked(sdk.parseRecipeUrlApiRecipesCreateUrlPost).mockResolvedValue({
      data: "classic-guacamole",
    } as never)

    const { queryClient, wrapper } = setup()
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")
    const { result } = renderHook(() => useImportRecipe(), { wrapper })

    let outcome: string | undefined
    await act(async () => {
      outcome = await result.current.mutateAsync({
        url: "https://www.bbcgoodfood.com/recipes/classic-guacamole",
      })
    })

    expect(sdk.parseRecipeUrlApiRecipesCreateUrlPost).toHaveBeenCalledWith({
      body: {
        url: "https://www.bbcgoodfood.com/recipes/classic-guacamole",
        includeTags: true,
        includeCategories: true,
      },
    })
    expect(parseRecipeIngredients).toHaveBeenCalledWith("classic-guacamole")
    expect(outcome).toBe("classic-guacamole")
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["recipes"] })
  })

  it("throws formatted error when the API returns an error", async () => {
    vi.mocked(sdk.parseRecipeUrlApiRecipesCreateUrlPost).mockResolvedValue({
      error: { detail: "Failed to scrape" },
    } as never)

    const { wrapper } = setup()
    const { result } = renderHook(() => useImportRecipe(), { wrapper })

    await expect(result.current.mutateAsync({ url: "https://example.com/bad" })).rejects.toThrow(
      "Failed to scrape"
    )
  })
})

it("keeps a successful import when parsing fails and explains how to retry", async () => {
  vi.mocked(sdk.parseRecipeUrlApiRecipesCreateUrlPost).mockResolvedValue({ data: "soup" } as never)
  vi.mocked(parseRecipeIngredients).mockRejectedValueOnce(new Error("AI unavailable"))
  const { wrapper } = setup()
  const { result } = renderHook(() => useImportRecipe(), { wrapper })
  await act(async () => {
    expect(await result.current.mutateAsync({ url: "https://example.com/soup" })).toBe("soup")
  })
  expect(toastManager.add).toHaveBeenCalledWith(
    expect.objectContaining({
      title: "Recipe imported; ingredients need attention",
      description: "AI unavailable",
    })
  )
})
