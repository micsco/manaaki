import { createMiddleware, createStart } from "@tanstack/react-start"

import { handleSilentLoginRequest } from "./server/silentLogin"

const silentLoginMiddleware = createMiddleware({ type: "request" }).server(
  ({ request, handlerType, next }) => handleSilentLoginRequest(request, handlerType) ?? next()
)

export const startInstance = createStart(() => ({
  requestMiddleware: [silentLoginMiddleware],
}))
