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

// Node's fetch (undici) transparently decompresses the upstream body, so the
// upstream content-encoding/content-length describe the *compressed* bytes and
// no longer match what we stream downstream. Passing them through makes nginx
// log "upstream sent more data than specified in Content-Length" and can
// truncate the body. Drop them (plus hop-by-hop headers) and let the runtime
// re-derive the framing for the decoded body.
const STRIP_RESPONSE_HEADERS = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
])

// Re-emit an upstream response with framing headers that match the decoded body.
function passthroughResponse(upstream: Response): Response {
  const headers = new Headers(upstream.headers)
  for (const name of STRIP_RESPONSE_HEADERS) headers.delete(name)
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  })
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
    redirect: "manual",
    // @ts-expect-error Node fetch requires duplex for streamed bodies
    duplex: "half",
  })
}

async function maybeRefresh(token: string): Promise<string | null> {
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
    const refreshed = await maybeRefresh(userToken)
    const effective = refreshed ?? userToken
    const res = await forward(request, effective, pathWithQuery)
    const out = passthroughResponse(res)
    out.headers.set("Cache-Control", "private, no-store")
    if (refreshed) {
      out.headers.append("Set-Cookie", buildSessionSetCookie(refreshed, isSecureRequest(request)))
    }
    return out
  }

  if (!isAnonymousAllowed(request.method, url.pathname)) {
    return new Response("Forbidden", { status: 403 })
  }
  return passthroughResponse(await forward(request, readonlyToken(), pathWithQuery))
}
