import { createIsomorphicFn } from "@tanstack/react-start"

import { clientFetch } from "./clientFetch"
import { retryingFetch } from "./retryingFetch"

export const timedFetch = createIsomorphicFn()
  .server(async (input: RequestInfo | URL, init?: RequestInit) => {
    const { measureServerTiming } = await import("../server/timing")
    const { mealieFetch } = await import("../server/mealieUpstream")
    return measureServerTiming("mealie", () => retryingFetch(input, init, mealieFetch))
  })
  .client(clientFetch)
