import { describe, expect, it } from "vitest"

import { routeTemplate } from "./routeTemplate"

const RECIPE_ID = "0b1a6f0e-4c1d-4c62-9a5b-1e2f3a4b5c6d"

describe("routeTemplate", () => {
  it.each([
    ["/", "/"],
    ["/plan", "/plan"],
    ["/recipes", "/recipes"],
    ["/recipes/chicken-fajitas", "/recipes/{slug}"],
    [`/recipes/${RECIPE_ID}/chicken-fajitas`, "/recipes/{id}/{slug}"],
    [`/recipes/${RECIPE_ID}/chicken-fajitas/new-version`, "/recipes/{id}/{slug}/new-version"],
    ["/api/recipes", "/api/recipes"],
    ["/api/recipes/chicken-fajitas", "/api/recipes/{slug}"],
    [`/api/recipes/${RECIPE_ID}/comments`, "/api/recipes/{slug}/comments"],
    ["/api/recipes/suggestions", "/api/recipes/suggestions"],
    ["/api/recipes/timeline/events", "/api/recipes/timeline/events"],
    [
      `/api/media/recipes/${RECIPE_ID}/images/min-original.webp`,
      "/api/media/recipes/{id}/images/min-original.webp",
    ],
    ["/api/households/mealplans/42", "/api/households/mealplans/{id}"],
    ["/api/manaaki/recipe-versions/draft", "/api/manaaki/recipe-versions/draft"],
  ])("names %s as %s", (pathname, template) => {
    expect(routeTemplate(pathname)).toBe(template)
  })

  it("groups paths outside the app so bots can't create new span names", () => {
    expect(routeTemplate("/wp-login.php")).toBe("unmatched")
    expect(routeTemplate("/.env")).toBe("unmatched")
  })
})
