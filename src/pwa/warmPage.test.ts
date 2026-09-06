import { afterEach, expect, it, vi } from "vitest"

import { warmVisiblePage } from "./warmPage"

afterEach(() => vi.unstubAllGlobals())

it("warms the visible recipe without navigating or cancelling in-flight queries", () => {
  vi.stubGlobal("location", { pathname: "/recipes/AAAAAAAAQACAAAAAAAAAAQ/pasta-carbonara" })
  const fetch = vi.fn().mockResolvedValue(new Response())
  vi.stubGlobal("fetch", fetch)
  const refetchQueries = vi.fn().mockResolvedValue(undefined)
  warmVisiblePage({ refetchQueries })
  expect(refetchQueries).toHaveBeenCalledWith({ type: "active" }, { cancelRefetch: false })
  expect(fetch).toHaveBeenCalledWith("/api/recipes/00000000-0000-4000-8000-000000000001")
})

it("does not fetch a recipe for other routes", () => {
  vi.stubGlobal("location", { pathname: "/shopping" })
  const fetch = vi.fn()
  vi.stubGlobal("fetch", fetch)
  warmVisiblePage({ refetchQueries: vi.fn().mockResolvedValue(undefined) })
  expect(fetch).not.toHaveBeenCalled()
})
