import { createMiddleware, createStart } from "@tanstack/react-start"

import { handleSilentLoginRequest } from "./server/silentLogin"

const timingMiddleware = createMiddleware({ type: "request" }).server(async ({ request, next }) => {
  const { withServerTiming } = await import("./server/timing")
  return withServerTiming(
    next,
    request.headers.get("accept")?.includes("text/html") ? "ssr" : "app"
  )
})

const silentLoginMiddleware = createMiddleware({ type: "request" }).server(
  ({ request, handlerType, next }) => handleSilentLoginRequest(request, handlerType) ?? next()
)

export const startInstance = createStart(() => ({
  requestMiddleware: [timingMiddleware, silentLoginMiddleware],
}))
