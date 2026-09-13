import { createIsomorphicFn } from "@tanstack/react-start"

import { retryingFetch } from "./retryingFetch"

export const timedFetch = createIsomorphicFn()
  .server(async (input: RequestInfo | URL, init?: RequestInit) => {
    const { measureServerTiming } = await import("../server/timing")
    return measureServerTiming("mealie", () => retryingFetch(input, init))
  })
  .client(retryingFetch)
