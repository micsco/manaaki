import { createFileRoute } from "@tanstack/react-router"

import { buildClearLoginAttemptCookie, completeNativeLogin } from "../server/nativeOidc"
import { buildSessionSetCookie, isSecureRequest } from "../server/session"

export async function completeHandler(request: Request): Promise<Response> {
  const secure = isSecureRequest(request)
  const headers = new Headers()
  headers.append("Set-Cookie", buildClearLoginAttemptCookie(secure))
  try {
    const token = await completeNativeLogin(request)
    headers.set("Location", "/recipes")
    headers.append("Set-Cookie", buildSessionSetCookie(token, secure))
  } catch {
    headers.set("Location", "/login?error=oauth")
  }
  return new Response(null, { status: 302, headers })
}

export const Route = createFileRoute("/api/auth/complete")({
  server: { handlers: { GET: ({ request }) => completeHandler(request) } },
})
