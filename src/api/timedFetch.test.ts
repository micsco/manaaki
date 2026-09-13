import { afterEach, expect, it, vi } from "vitest"

import { withServerTiming } from "../server/timing"
import { timedFetch } from "./timedFetch"

afterEach(() => vi.restoreAllMocks())

it("times server fetches without changing the request or exposing its credentials", async () => {
  const upstream = new Response("recipe", { headers: { "Content-Type": "text/plain" } })
  const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(upstream)
  const request = new Request("https://mealie.example/api/recipes/private", {
    headers: { Authorization: "Bearer private-token" },
  })
  const result = await withServerTiming(async () => ({ response: await timedFetch(request) }))
  expect(fetch).toHaveBeenCalledWith(request, undefined)
  expect(result.response.headers.get("Server-Timing")).toMatch(
    /^mealie;dur=[\d.]+, app;dur=[\d.]+$/
  )
  expect(await result.response.text()).toBe("recipe")
})
