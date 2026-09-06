import { describe, expect, it } from "vitest"

import { cacheGroup, evictionCandidates, type CacheEntry } from "./cachePolicy"

const entry = (group: string, hits: number, accessedAt: number, bytes = 10): CacheEntry => ({
  url: group,
  group: `recipe:${group}`,
  hits,
  accessedAt,
  bytes,
  cachedAt: 0,
})
const limits = { recipes: 2, recent: 1, other: 1, bytes: 100 }

describe("automatic cache retention", () => {
  it("keeps a popular recipe and a newly opened recipe ahead of a one-off visit", () => {
    expect(
      evictionCandidates(
        [entry("popular", 50, 10), entry("once", 1, 20), entry("new", 1, 30)],
        40,
        limits
      )
    ).toEqual(["once"])
  })
  it("evicts images together with their recipe and respects the byte budget", () => {
    const recipe = entry("large", 1, 10, 80)
    expect(
      evictionCandidates([recipe, { ...recipe, url: "image", bytes: 30 }], 20, limits)
    ).toEqual(["large", "image"])
  })
  it("only allows recipe and planning reads into the data cache", () => {
    expect(cacheGroup("/api/recipes/abc")).toBe("recipe:abc")
    expect(cacheGroup("/api/media/recipes/abc/images/original.webp")).toBe("recipe:abc")
    expect(cacheGroup("/api/auth/oauth")).toBeNull()
    expect(cacheGroup("/api/users/self")).toBeNull()
    expect(cacheGroup("/api/households/shopping/lists/abc")).not.toBeNull()
  })
})
