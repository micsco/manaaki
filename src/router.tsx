import { createRouter } from "@tanstack/react-router"
import { queryClient } from "./routes/__root"
import { routeTree } from "./routeTree.gen"

export function getRouter() {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    context: { queryClient },
  })
  return router
}
