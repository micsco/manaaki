import { createFileRoute } from "@tanstack/react-router"

import { getLoggedInUserApiUsersSelfGet } from "../api/generated"
import { createMealieClient } from "../server/mealieClient"
import {
  buildClearLoginAttemptCookie,
  completeNativeLogin,
  readLoginAttempt,
} from "../server/nativeOidc"
import { buildSessionSetCookie, isSecureRequest } from "../server/session"
import { buildKnownDeviceSetCookie, safeReturnPath } from "../server/silentLogin"

const LOGIN_ERROR_PATH = "/login?error=oauth"

async function signedInEmail(token: string): Promise<string | null> {
  try {
    const result = await getLoggedInUserApiUsersSelfGet({
      client: createMealieClient(token),
      throwOnError: false,
    })
    return result.data?.email ?? null
  } catch {
    return null
  }
}

export async function completeHandler(request: Request): Promise<Response> {
  const secure = isSecureRequest(request)
  const attempt = readLoginAttempt(request)
  const returnTo = safeReturnPath(attempt?.returnTo)
  const failurePath = attempt?.silent ? returnTo : LOGIN_ERROR_PATH

  const headers = new Headers()
  headers.append("Set-Cookie", buildClearLoginAttemptCookie(secure))

  if (new URL(request.url).searchParams.has("error")) {
    headers.set("Location", failurePath)
    return new Response(null, { status: 302, headers })
  }

  try {
    const token = await completeNativeLogin(request)
    headers.set("Location", returnTo)
    headers.append("Set-Cookie", buildSessionSetCookie(token, secure))
    const email = await signedInEmail(token)
    if (email) headers.append("Set-Cookie", buildKnownDeviceSetCookie(email, secure))
  } catch {
    headers.set("Location", failurePath)
  }
  return new Response(null, { status: 302, headers })
}

export const Route = createFileRoute("/api/auth/complete")({
  server: { handlers: { GET: ({ request }) => completeHandler(request) } },
})
