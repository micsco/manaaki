import { createFileRoute } from "@tanstack/react-router"
import { buildClearSessionCookie, isSecureRequest } from "../server/session"

export function logoutHandler(request: Request): Response {
  const headers = new Headers()
  headers.append("Set-Cookie", buildClearSessionCookie(isSecureRequest(request)))
  return new Response(null, { status: 204, headers })
}

export const Route = createFileRoute("/api/auth/logout")({
  server: { handlers: { POST: ({ request }) => logoutHandler(request) } },
})
