import { createFileRoute } from "@tanstack/react-router"
import { getLoggedInUserApiUsersSelfGet } from "../api/generated"
import { readonlyToken } from "../server/env"
import { createMealieClient } from "../server/mealieClient"
import { readSessionToken } from "../server/session"

export async function meHandler(request: Request): Promise<Response> {
  const userToken = readSessionToken(request)
  const token = userToken ?? readonlyToken()
  const client = createMealieClient(token)
  const { data } = await getLoggedInUserApiUsersSelfGet({ client, throwOnError: false })
  return Response.json({ user: data ?? null, isAnonymous: userToken === null })
}

export const Route = createFileRoute("/api/auth/me")({
  server: { handlers: { GET: ({ request }) => meHandler(request) } },
})
