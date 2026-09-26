import { readFileSync } from "node:fs"

import { QueryClient } from "@tanstack/react-query"
import { afterEach, expect, it } from "vitest"

import { recipeDiscoveryQueryOptions } from "../hooks/useRecipeDiscovery"
import { client } from "./generated/client.gen"

const originalConfig = client.getConfig()
afterEach(() => client.setConfig(originalConfig))

it("uses the 3.28.0 wire contract without filtering on household associations", async () => {
  const schema = JSON.parse(readFileSync("schema/mealie-v3.28.0.openapi.json", "utf8"))
  expect(schema.info.version).toBe("v3.28.0")
  const parameters = new Set(
    schema.paths["/api/recipes/timeline/events"].get.parameters.map(
      (parameter: { name: string }) => parameter.name
    )
  )
  const requestedPages: string[] = []
  client.setConfig({
    baseUrl: "https://mealie.test",
    fetch: async request => {
      const url = new URL((request as Request).url)
      if (url.pathname === "/api/households/mealplans")
        return Response.json({ items: [], total_pages: 1 })
      expect(url.pathname).toBe("/api/recipes/timeline/events")
      for (const parameter of url.searchParams.keys()) expect(parameters.has(parameter)).toBe(true)
      if (url.searchParams.has("queryFilter")) {
        return Response.json(
          {
            detail:
              "Cannot filter on ColumnAssociationProxyInstance(AssociationProxy('user', 'household_id'))",
          },
          { status: 400 }
        )
      }
      const page = url.searchParams.get("page")!
      requestedPages.push(page)
      return Response.json({
        items: [
          {
            id: `own-${page}`,
            householdId: "home",
            recipeId: "recipe",
            eventType: "info",
            subject: "Mike made this for dinner",
            timestamp: "2026-09-01T00:00:00Z",
          },
          { id: `other-${page}`, householdId: "another-home", recipeId: "other" },
        ],
        total_pages: 2,
      })
    },
  })
  const queryClient = new QueryClient()
  const data = await queryClient.fetchQuery({
    ...recipeDiscoveryQueryOptions("user", "home", "2026-09-26"),
    retry: false,
  })
  expect(requestedPages).toEqual(["1", "2"])
  expect(data.events.map(event => event.id)).toEqual(["own-1", "own-2"])
  expect(queryClient.getQueryData(["recipeDiscovery", "user", "home", "2026-09-26"])).toEqual(data)
  queryClient.clear()
})
