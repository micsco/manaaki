import { createRouter } from "@tanstack/react-router"
import { client, configureApiClient } from "./api/client"
import { queryClient } from "./lib/queryClient"
import { routeTree } from "./routeTree.gen"

configureApiClient()

export function getRouter() {
  configureApiClient()
  if (!client) {
    throw new Error("API client is not initialized")
  }
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    context: { queryClient },
    defaultPendingMs: 0,
  })
  return router
}
