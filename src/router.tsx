import { createRouter } from "@tanstack/react-router"
import { queryClient } from "./lib/queryClient"
import { routeTree } from "./routeTree.gen"

export function getRouter() {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    context: { queryClient },
    defaultPendingMs: 0,
  })
  return router
}
