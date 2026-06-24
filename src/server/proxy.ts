// src/server/proxy.ts
import { isAnonymousAllowed } from "./allowlist"
import { parseCookie } from "./cookies"
import { mealieInternalUrl, readonlyToken } from "./env"
import {
  buildSessionSetCookie,
  decodeJwtExp,
  isSecureRequest,
  readSessionToken,
  SESSION_COOKIE_NAME,
  unsealSession,
} from "./session"

const REFRESH_WINDOW_SECONDS = 60 * 60 // refresh if < 1h to expiry
const STRIP_REQUEST_HEADERS = new Set([
  "authorization",
  "cookie",
  "host",
  "connection",
  "content-length",
])

/**
 * Read the session token, trying both secure and insecure cookie names.
 * This handles edge cases where the cookie was set in a different security context
 * (e.g., in tests or local dev where x-forwarded-proto may not match the cookie that was set).
 */
function readSessionTokenFallback(request: Request): string | null {
  const token = readSessionToken(request)
  if (token !== null) return token
  // Try the other security level's cookie name as a fallback
  const secure = isSecureRequest(request)
  const otherName = SESSION_COOKIE_NAME(!secure)
  const cookieHeader = request.headers.get("cookie")
  const sealed = parseCookie(cookieHeader, otherName)
  return sealed ? unsealSession(sealed) : null
}

function upstreamHeaders(request: Request, token: string): Headers {
  const headers = new Headers()
  for (const [k, v] of request.headers) {
    if (!STRIP_REQUEST_HEADERS.has(k.toLowerCase())) headers.set(k, v)
  }
  headers.set("Authorization", `Bearer ${token}`)
  const host = request.headers.get("host")
  if (host) headers.set("Host", host)
  headers.set("X-Forwarded-Proto", isSecureRequest(request) ? "https" : "http")
  return headers
}

async function forward(request: Request, token: string, pathWithQuery: string): Promise<Response> {
  const url = `${mealieInternalUrl()}${pathWithQuery}`
  const hasBody = request.method !== "GET" && request.method !== "HEAD"
  return fetch(url, {
    method: request.method,
    headers: upstreamHeaders(request, token),
    body: hasBody ? request.body : undefined,
    // @ts-expect-error Node fetch requires duplex for streamed bodies
    duplex: "half",
  })
}

async function maybeRefresh(request: Request, token: string): Promise<string | null> {
  const exp = decodeJwtExp(token)
  if (exp === null) return null
  const secondsLeft = exp - Math.floor(Date.now() / 1000)
  if (secondsLeft > REFRESH_WINDOW_SECONDS) return null
  try {
    const res = await fetch(`${mealieInternalUrl()}/api/auth/refresh`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const body = (await res.json()) as { access_token?: string }
    return typeof body.access_token === "string" ? body.access_token : null
  } catch {
    return null
  }
}

export async function handleApiProxy(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const pathWithQuery = url.pathname + url.search
  const userToken = readSessionTokenFallback(request)

  if (userToken) {
    const refreshed = await maybeRefresh(request, userToken)
    const effective = refreshed ?? userToken
    const res = await forward(request, effective, pathWithQuery)
    if (refreshed) {
      const out = new Response(res.body, res)
      out.headers.append("Set-Cookie", buildSessionSetCookie(refreshed, isSecureRequest(request)))
      return out
    }
    return res
  }

  if (!isAnonymousAllowed(request.method, url.pathname)) {
    return new Response("Forbidden", { status: 403 })
  }
  return forward(request, readonlyToken(), pathWithQuery)
}
