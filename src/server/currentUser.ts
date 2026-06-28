import { getLoggedInUserApiUsersSelfGet, type UserOut } from "../api/generated"
import { readonlyToken } from "./env"
import { createMealieClient } from "./mealieClient"
import { readSessionToken } from "./session"

// Resolve the current user directly from an incoming request's session cookie.
// Server-only (imports node:crypto via ./session). Used by the /api/auth/me
// handler AND by SSR (fetchCurrentUser) so the guard never does a relative
// self-fetch that Node can't parse.
export async function resolveCurrentUser(
  request: Request
): Promise<{ user: UserOut | null; isAnonymous: boolean }> {
  const userToken = readSessionToken(request)
  const token = userToken ?? readonlyToken()
  const client = createMealieClient(token)
  const { data } = await getLoggedInUserApiUsersSelfGet({ client, throwOnError: false })
  return { user: data ?? null, isAnonymous: userToken === null }
}
