import { createFileRoute } from "@tanstack/react-router"
import { resolveCurrentUser } from "../server/currentUser"

export async function meHandler(request: Request): Promise<Response> {
  const current = await resolveCurrentUser(request)
  return Response.json(current, { headers: { "Cache-Control": "private, no-store" } })
}

export const Route = createFileRoute("/api/auth/me")({
  server: { handlers: { GET: ({ request }) => meHandler(request) } },
})
