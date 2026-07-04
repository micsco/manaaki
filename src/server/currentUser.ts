import { getLoggedInUserApiUsersSelfGet, type UserOut } from "../api/generated"
import { readonlyToken } from "./env"
import { createMealieClient } from "./mealieClient"
import { readSessionToken } from "./session"

async function getUser(token: string): Promise<UserOut | null> {
  const client = createMealieClient(token)
  const result = await getLoggedInUserApiUsersSelfGet({ client, throwOnError: false })
  if (result.data) return result.data
  if (result.response?.status === 401) return null
  throw new Error("Failed to resolve current user")
}

export async function resolveCurrentUser(
  request: Request
): Promise<{ user: UserOut | null; isAnonymous: boolean }> {
  const userToken = readSessionToken(request)
  if (userToken) {
    const user = await getUser(userToken)
    if (user) return { user, isAnonymous: false }
  }

  return { user: await getUser(readonlyToken()), isAnonymous: true }
}
