import { createFileRoute } from "@tanstack/react-router"
import { completeOidc } from "../server/oauth"
import { buildSessionSetCookie, isSecureRequest } from "../server/session"

export async function completeHandler(request: Request): Promise<Response> {
  try {
    const token = await completeOidc(request)
    const headers = new Headers({ Location: "/recipes" })
    headers.append("Set-Cookie", buildSessionSetCookie(token, isSecureRequest(request)))
    return new Response(null, { status: 302, headers })
  } catch {
    return new Response(null, { status: 302, headers: { Location: "/login?error=oauth" } })
  }
}

export const Route = createFileRoute("/api/auth/complete")({
  server: { handlers: { GET: ({ request }) => completeHandler(request) } },
})
