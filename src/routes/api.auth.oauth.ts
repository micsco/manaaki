import { createFileRoute } from "@tanstack/react-router"

import { reportLoginFailure } from "../server/loginFailures"
import { beginNativeLogin } from "../server/nativeOidc"

async function startHandler(request: Request): Promise<Response> {
  try {
    return await beginNativeLogin(request)
  } catch (error) {
    reportLoginFailure("start", error)
    return new Response(null, {
      status: 302,
      headers: { Location: "/login?error=oauth", "Cache-Control": "no-store" },
    })
  }
}

export const Route = createFileRoute("/api/auth/oauth")({
  server: { handlers: { GET: ({ request }) => startHandler(request) } },
})
