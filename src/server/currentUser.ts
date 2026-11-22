import type { CurrentUser } from "../api/auth"
import { getLoggedInUserApiUsersSelfGet, type UserOut } from "../api/generated"
import { readonlyToken } from "./env"
import { createMealieClient } from "./mealieClient"
import { isMealieOverloaded, MealieUnreachableError } from "./mealieUpstream"
import { readSessionToken } from "./session"
import { measureServerTiming } from "./timing"

const REJECTED_TOKEN_STATUSES = new Set([401, 403])

function upstreamFailure(error: unknown, status?: number): Error {
  if (isMealieOverloaded(error)) return error as Error
  return new MealieUnreachableError(
    `Mealie could not resolve the current user (${status ?? "no response"})`,
    { cause: error }
  )
}

async function getUser(token: string): Promise<UserOut | null> {
  const client = createMealieClient(token)
  const result = await measureServerTiming("identity", () =>
    getLoggedInUserApiUsersSelfGet({ client, throwOnError: false })
  ).catch((error: unknown) => {
    throw upstreamFailure(error)
  })
  if (result.data) return result.data
  const status = result.response?.status
  if (status !== undefined && REJECTED_TOKEN_STATUSES.has(status)) return null
  throw upstreamFailure(result.error, status)
}

export async function resolveCurrentUser(request: Request): Promise<CurrentUser> {
  const userToken = readSessionToken(request)
  if (userToken) {
    const user = await getUser(userToken)
    if (user) return { user, isAnonymous: false, groupSlug: user.groupSlug }
  }

  const serviceAccount = await getUser(readonlyToken())
  return { user: null, isAnonymous: true, groupSlug: serviceAccount?.groupSlug ?? null }
}
