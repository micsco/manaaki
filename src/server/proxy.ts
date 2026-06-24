// src/server/proxy.ts
import { isAnonymousAllowed } from "./allowlist"
import { mealieInternalUrl, readonlyToken } from "./env"
import { buildSessionSetCookie, decodeJwtExp, isSecureRequest, readSessionToken } from "./session"

const REFRESH_WINDOW_SECONDS = 60 * 60 // refresh if < 1h to expiry
const STRIP_REQUEST_HEADERS = new Set([
  "authorization",
  "cookie",
  "host",
  "connection",
  "content-length",
])

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
  const userToken = readSessionToken(request)

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
