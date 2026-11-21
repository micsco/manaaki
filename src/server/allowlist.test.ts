import { describe, expect, it } from "vitest"

import { canonicalizeApiPath, isAnonymousAllowed, isAuthenticatedAllowed } from "./allowlist"

describe("canonicalizeApiPath", () => {
  it("accepts normal and UTF-8 percent-encoded API paths", () => {
    expect(canonicalizeApiPath("/api/recipes/cr%C3%A8me-br%C3%BBl%C3%A9e")).toBe(
      "/api/recipes/crème-brûlée"
    )
    expect(canonicalizeApiPath("/api/users/self")).toBe("/api/users/self")
  })

  it.each([
    "/api/recipes/%2e%2e/households/mealplans",
    "/api/recipes/../households/mealplans",
    "/api/recipes/%2e/timeline/events",
    "/api/recipes/./timeline/events",
    "/api/recipes/%252e%252e/households/mealplans",
    "/api/recipes//timeline/events",
    "/api/recipes/foo%2fbar",
    "/api/recipes/foo%5cbar",
    "/api/recipes/foo\\bar",
    "/api/recipes/foo%00bar",
    "/api/recipes/%bad",
    "api/recipes",
  ])("rejects traversal and malformed paths: %s", path => {
    expect(canonicalizeApiPath(path)).toBeNull()
  })
})

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
  it.each([
    "/api/recipes/%2e%2e/households/mealplans",
    "/api/recipes/../users/self",
    "/api/recipes/%252e%252e/admin/users",
    "/api/media/recipes/%2e%2e/%2e%2e/households/mealplans",
  ])("blocks path traversal bypasses: %s", path => {
    expect(isAnonymousAllowed("GET", path)).toBe(false)
  })
})

it.each([
  "/api/recipes/timeline",
  "/api/recipes/timeline/events",
  "/api/recipes/timeline/events/123/image",
  "/api/recipes/%74imeline/events",
  "/api/recipes/TIMELINE/events",
  "/api/recipes//timeline/events",
  "/api/recipes/%2e/timeline/events",
  "/api/recipes/%bad",
])("keeps cooking history private: %s", path => {
  expect(isAnonymousAllowed("GET", path)).toBe(false)
})

describe("isAuthenticatedAllowed", () => {
  it.each([
    ["GET", "/api/recipes"],
    ["GET", "/api/recipes/timeline/events"],
    ["GET", "/api/media/recipes/abc/images/original.webp"],
    ["GET", "/api/users/self"],
    ["GET", "/api/households/mealplans"],
    ["POST", "/api/households/mealplans"],
    ["PUT", "/api/households/mealplans/123"],
    ["DELETE", "/api/households/mealplans/123"],
    ["GET", "/api/households/shopping/lists/123"],
    ["POST", "/api/households/shopping/lists/123/recipe"],
    ["POST", "/api/households/shopping/items/create-bulk"],
    ["PUT", "/api/households/shopping/items/123"],
    ["DELETE", "/api/households/shopping/items/123"],
    ["POST", "/api/recipes/create/url"],
    ["POST", "/api/recipes/slug/duplicate"],
    ["PATCH", "/api/recipes/slug"],
    ["POST", "/api/parser/ingredients"],
    ["GET", "/api/foods"],
    ["POST", "/api/foods"],
    ["GET", "/api/units"],
    ["POST", "/api/units"],
    ["GET", "/api/organizers/tools/slug/air-fryer"],
  ])("allows Mealie endpoints Manaaki uses: %s %s", (method, path) => {
    expect(isAuthenticatedAllowed(method, path)).toBe(true)
  })

  it.each([
    ["GET", "/api/admin/users"],
    ["POST", "/api/admin/backups"],
    ["POST", "/api/users/api-tokens"],
    ["DELETE", "/api/users/self"],
    ["GET", "/api/users"],
    ["GET", "/api/groups/self"],
    ["POST", "/api/households/webhooks"],
    ["POST", "/api/auth/token"],
    ["DELETE", "/api/recipes/slug"],
    ["GET", "/api/recipes/%2e%2e/admin/users"],
  ])("blocks admin, token, and unused Mealie endpoints: %s %s", (method, path) => {
    expect(isAuthenticatedAllowed(method, path)).toBe(false)
  })
})
