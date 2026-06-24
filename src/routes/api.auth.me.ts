import { createFileRoute } from "@tanstack/react-router"
import { mealieInternalUrl, readonlyToken } from "../server/env"
import { readSessionToken } from "../server/session"

export async function meHandler(request: Request): Promise<Response> {
  const userToken = readSessionToken(request)
  const token = userToken ?? readonlyToken()
  const resp = await fetch(`${mealieInternalUrl()}/api/users/self`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = resp.ok ? await resp.json() : null
  return Response.json({ user: data, isAnonymous: userToken === null })
}

export const Route = createFileRoute("/api/auth/me")({
  server: { handlers: { GET: ({ request }) => meHandler(request) } },
})
