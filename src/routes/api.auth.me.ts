import { createFileRoute } from "@tanstack/react-router"

import { resolveCurrentUser } from "../server/currentUser"
import { upstreamFailureResponse } from "../server/mealieUpstream"

export async function meHandler(request: Request): Promise<Response> {
  try {
    const current = await resolveCurrentUser(request)
    return Response.json(current, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    const failure = upstreamFailureResponse(error)
    if (failure) return failure
    throw error
  }
}

export const Route = createFileRoute("/api/auth/me")({
  server: { handlers: { GET: ({ request }) => meHandler(request) } },
})
