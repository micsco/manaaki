import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it } from "vitest"
import { recipeListQueryOptions } from "./useRecipeList"
import { useRecipeNameMap } from "./useRecipeNameMap"

describe("useRecipeNameMap", () => {
  it("maps recipeId -> {name, slug}, dedupes, ignores id-less", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    qc.setQueryData(recipeListQueryOptions.queryKey, [
      { id: "r1", name: "Soup", slug: "soup" },
      { id: "r1", name: "Soup dup", slug: "soup" },
      { id: null, name: "x", slug: "x" },
    ])
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useRecipeNameMap(), { wrapper })
    expect(result.current.get("r1")).toEqual({ name: "Soup", slug: "soup" })
    expect(result.current.size).toBe(1)
  })
})
