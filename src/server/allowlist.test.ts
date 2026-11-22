import { describe, expect, it } from "vitest"

import { canonicalizeApiPath, isAnonymousAllowed, isAuthenticatedAllowed } from "./allowlist"

describe("canonicalizeApiPath", () => {
  it("accepts normal and UTF-8 percent-encoded API paths", () => {
    expect(canonicalizeApiPath("/api/recipes/cr%C3%A8me-br%C3%BBl%C3%A9e")).toBe(
      "/api/recipes/crème-brûlée"
    )
    expect(canonicalizeApiPath("/api/foods")).toBe("/api/foods")
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

const RECIPE = "00000000-0000-4000-8000-000000000001"

describe("isAnonymousAllowed", () => {
  it.each([
    "/api/recipes",
    "/api/recipes/pasta-carbonara",
    "/api/recipes/cr%C3%A8me-br%C3%BBl%C3%A9e",
    `/api/media/recipes/${RECIPE}/images/original.webp`,
    `/api/media/recipes/${RECIPE}/images/min-original.webp`,
  ])("allows the public recipe reads Manaaki makes: %s", path => {
    expect(isAnonymousAllowed("GET", path)).toBe(true)
  })

  it.each([
    "/api/users/self",
    "/api/recipes/exports",
    "/api/recipes/suggestions",
    "/api/recipes/bulk-actions/export",
    "/api/recipes/shared/token",
    "/api/recipes/Exports",
    "/api/recipes/%65xports",
    "/api/recipes/slug/comments",
    "/api/recipes/slug/exports",
    `/api/media/recipes/${RECIPE}/assets/file.pdf`,
    `/api/media/recipes/${RECIPE}/images`,
    "/api/media/recipes/x.png",
    "/api/households/mealplans",
    "/api/admin/users",
    "/api/auth/oauth",
    "/api/auth/oauth/callback",
    "/api/recipesX",
  ])("denies everything else: %s", path => {
    expect(isAnonymousAllowed("GET", path)).toBe(false)
  })

  it("denies non-GET even on allowed paths", () => {
    expect(isAnonymousAllowed("POST", "/api/recipes")).toBe(false)
    expect(isAnonymousAllowed("DELETE", "/api/recipes/abc")).toBe(false)
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
  "/api/recipes/%74imeline",
  "/api/recipes/TIMELINE",
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
    ["GET", "/api/recipes/pasta-carbonara"],
    ["GET", "/api/recipes/timeline/events"],
    ["GET", `/api/media/recipes/${RECIPE}/images/original.webp`],
    ["GET", "/api/households/mealplans"],
    ["POST", "/api/households/mealplans"],
    ["PUT", "/api/households/mealplans/123"],
    ["DELETE", "/api/households/mealplans/123"],
    ["GET", "/api/households/shopping/lists"],
    ["GET", "/api/households/shopping/lists/123"],
    ["POST", "/api/households/shopping/lists"],
    ["DELETE", "/api/households/shopping/lists/123"],
    ["POST", "/api/households/shopping/lists/123/recipe"],
    ["POST", `/api/households/shopping/lists/123/recipe/${RECIPE}/delete`],
    ["GET", "/api/households/shopping/items/123"],
    ["POST", "/api/households/shopping/items/create-bulk"],
    ["PUT", "/api/households/shopping/items/123"],
    ["DELETE", "/api/households/shopping/items/123"],
    ["POST", "/api/recipes/create/url"],
    ["POST", "/api/recipes/pasta-carbonara/duplicate"],
    ["PATCH", "/api/recipes/pasta-carbonara"],
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
    ["GET", "/api/users/self"],
    ["DELETE", "/api/users/self"],
    ["GET", "/api/users"],
    ["GET", "/api/groups/self"],
    ["POST", "/api/households/webhooks"],
    ["POST", "/api/auth/token"],
    ["DELETE", "/api/recipes/slug"],
    ["PUT", "/api/recipes/slug"],
    ["POST", "/api/recipes"],
    ["PATCH", "/api/recipes"],
    ["PATCH", "/api/recipes/timeline"],
    ["POST", "/api/recipes/bulk-actions/delete"],
    ["POST", "/api/recipes/bulk-actions/tag"],
    ["POST", "/api/recipes/create/zip"],
    ["POST", "/api/recipes/create/url/bulk"],
    ["POST", "/api/recipes/test-scrape-url"],
    ["POST", "/api/recipes/slug/assets"],
    ["POST", "/api/recipes/slug/image"],
    ["POST", "/api/recipes/timeline/events"],
    ["PUT", "/api/recipes/timeline/events/123"],
    ["POST", "/api/recipes/timeline/duplicate"],
    ["GET", "/api/recipes/exports"],
    ["GET", "/api/recipes/slug/comments"],
    ["GET", `/api/media/recipes/${RECIPE}/assets/file.pdf`],
    ["GET", "/api/households/shopping/lists/123/extra"],
    ["GET", "/api/recipes/%2e%2e/admin/users"],
  ])("blocks admin, token, and unused Mealie endpoints: %s %s", (method, path) => {
    expect(isAuthenticatedAllowed(method, path)).toBe(false)
  })
})
