import { createFileRoute } from "@tanstack/react-router"

import { beginNativeLogin } from "../server/nativeOidc"

async function startHandler(request: Request): Promise<Response> {
  try {
    return await beginNativeLogin(request)
  } catch {
    return new Response(null, { status: 302, headers: { Location: "/login?error=oauth" } })
  }
}

export const Route = createFileRoute("/api/auth/oauth")({
  server: { handlers: { GET: ({ request }) => startHandler(request) } },
})
