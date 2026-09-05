import { describe, expect, it } from "vitest"

import { isAnonymousAllowed } from "./allowlist"

describe("isAnonymousAllowed", () => {
  it("allows GET recipes, users/self, media", () => {
    expect(isAnonymousAllowed("GET", "/api/recipes")).toBe(true)
    expect(isAnonymousAllowed("GET", "/api/recipes/abc")).toBe(true)
    expect(isAnonymousAllowed("GET", "/api/users/self")).toBe(true)
    expect(isAnonymousAllowed("GET", "/api/media/recipes/x.png")).toBe(true)
  })
  it("no longer proxies Mealie's own OAuth endpoints for anonymous users", () => {
    expect(isAnonymousAllowed("GET", "/api/auth/oauth")).toBe(false)
    expect(isAnonymousAllowed("GET", "/api/auth/oauth/callback")).toBe(false)
  })
  it("denies meal plans for anonymous", () => {
    expect(isAnonymousAllowed("GET", "/api/households/mealplans")).toBe(false)
  })
  it("denies non-GET even on allowed paths", () => {
    expect(isAnonymousAllowed("POST", "/api/recipes")).toBe(false)
    expect(isAnonymousAllowed("DELETE", "/api/recipes/abc")).toBe(false)
  })
  it("denies unlisted paths", () => {
    expect(isAnonymousAllowed("GET", "/api/admin/users")).toBe(false)
  })
  it("denies paths with no segment boundary", () => {
    expect(isAnonymousAllowed("GET", "/api/recipesX")).toBe(false)
    expect(isAnonymousAllowed("GET", "/api/auth/oauthcallback")).toBe(false)
  })
})
