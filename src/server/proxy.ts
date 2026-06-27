// src/server/proxy.ts
import type http from "node:http"
import { request as httpRequest } from "node:http"
import { request as httpsRequest } from "node:https"
import { Readable } from "node:stream"
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

// node:http does NOT auto-decompress the upstream body (unlike undici/fetch), so
// content-encoding and content-length describe the actual bytes being streamed.
// Pass them through unchanged. Strip only true hop-by-hop headers.
const STRIP_RESPONSE_HEADERS = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "proxy-connection",
])

function upstreamHeaders(request: Request, token: string): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const [k, v] of request.headers) {
    if (!STRIP_REQUEST_HEADERS.has(k.toLowerCase())) headers[k] = v
  }
  headers.authorization = `Bearer ${token}`
  const host = request.headers.get("host")
  if (host) headers.host = host
  headers["x-forwarded-proto"] = isSecureRequest(request) ? "https" : "http"
  return headers
}

function buildResponseHeaders(incoming: http.IncomingMessage): Headers {
  const headers = new Headers()
  for (const [k, v] of Object.entries(incoming.headers)) {
    if (v === undefined) continue
    if (STRIP_RESPONSE_HEADERS.has(k.toLowerCase())) continue
    if (Array.isArray(v)) {
      for (const item of v) headers.append(k, item)
    } else {
      headers.set(k, v)
    }
  }
  return headers
}

function forward(request: Request, token: string, pathWithQuery: string): Promise<Response> {
  const base = new URL(mealieInternalUrl())
  const isHttps = base.protocol === "https:"
  const transport = isHttps ? httpsRequest : httpRequest
  const hasBody = request.method !== "GET" && request.method !== "HEAD"

  return new Promise((resolve, reject) => {
    const upstream = transport(
      {
        protocol: base.protocol,
        hostname: base.hostname,
        port: base.port || (isHttps ? 443 : 80),
        method: request.method,
        path: pathWithQuery,
        headers: upstreamHeaders(request, token),
      },
      res => {
        const headers = buildResponseHeaders(res)
        const status = res.statusCode ?? 502
        const noBody = status === 204 || status === 304 || request.method === "HEAD"
        resolve(
          new Response(noBody ? null : (Readable.toWeb(res) as ReadableStream), {
            status,
            statusText: res.statusMessage,
            headers,
          })
        )
      }
    )
    upstream.on("error", reject)
    if (hasBody && request.body) {
      // @ts-expect-error ReadableStream<Uint8Array> is compatible but types diverge
      Readable.fromWeb(request.body).pipe(upstream)
    } else {
      upstream.end()
    }
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
    // Build a fresh Response so we can mutate headers (forwarded Response headers
    // may be immutable in some runtimes).
    const outHeaders = new Headers(res.headers)
    outHeaders.set("Cache-Control", "private, no-store")
    if (refreshed) {
      outHeaders.append("Set-Cookie", buildSessionSetCookie(refreshed, isSecureRequest(request)))
    }
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: outHeaders,
    })
  }

  if (!isAnonymousAllowed(request.method, url.pathname)) {
    return new Response("Forbidden", { status: 403 })
  }
  return forward(request, readonlyToken(), pathWithQuery)
}
