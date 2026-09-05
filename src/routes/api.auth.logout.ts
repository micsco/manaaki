import { createFileRoute } from "@tanstack/react-router"

import { buildClearSessionCookie, isSecureRequest } from "../server/session"
import { buildClearKnownDeviceCookie } from "../server/silentLogin"

export function logoutHandler(request: Request): Response {
  const secure = isSecureRequest(request)
  const headers = new Headers()
  headers.append("Set-Cookie", buildClearSessionCookie(secure))
  headers.append("Set-Cookie", buildClearKnownDeviceCookie(secure))
  return new Response(null, { status: 204, headers })
}

export const Route = createFileRoute("/api/auth/logout")({
  server: { handlers: { POST: ({ request }) => logoutHandler(request) } },
})
