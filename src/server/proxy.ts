// src/server/proxy.ts
import type http from "node:http"
import { request as httpRequest } from "node:http"
import { request as httpsRequest } from "node:https"
import { Readable } from "node:stream"

import { isAnonymousAllowed } from "./allowlist"
import { mealieInternalUrl, readonlyToken } from "./env"
import {
  buildClearSessionCookie,
  buildSessionSetCookie,
  decodeJwtTiming,
  type JwtTiming,
  isSecureRequest,
  readSessionToken,
} from "./session"

// Tokens minted before Mealie 3.25 carry no iat, so fall back to a final-hour window.
const LEGACY_REFRESH_WINDOW_SECONDS = 60 * 60

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

type SessionToken =
  | { state: "valid"; token: string }
  | { state: "refreshed"; token: string }
  | { state: "invalid" }

function upstreamHeaders(request: Request, token: string): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const [k, v] of request.headers) {
    if (!STRIP_REQUEST_HEADERS.has(k.toLowerCase())) headers[k] = v
  }
  headers.authorization = `Bearer ${token}`
  headers.host = new URL(mealieInternalUrl()).host
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

function isPastRefreshPoint({ exp, iat }: JwtTiming, now: number): boolean {
  if (iat === null) return exp - now <= LEGACY_REFRESH_WINDOW_SECONDS
  return now >= iat + (exp - iat) / 2
}

async function resolveSessionToken(token: string): Promise<SessionToken> {
  const timing = decodeJwtTiming(token)
  if (timing === null) return { state: "valid", token }
  const now = Math.floor(Date.now() / 1000)
  if (timing.exp <= now) return { state: "invalid" }
  if (!isPastRefreshPoint(timing, now)) return { state: "valid", token }

  try {
    const res = await fetch(`${mealieInternalUrl()}/api/auth/refresh`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.status === 401) return { state: "invalid" }
    if (!res.ok) return { state: "valid", token }
    const body = (await res.json()) as { access_token?: string }
    return typeof body.access_token === "string"
      ? { state: "refreshed", token: body.access_token }
      : { state: "valid", token }
  } catch {
    return { state: "valid", token }
  }
}

function responseWithHeaders(response: Response, headers: Headers): Response {
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

function clearSessionHeaders(request: Request, initial?: Headers): Headers {
  const headers = initial ?? new Headers()
  headers.set("Cache-Control", "private, no-store")
  headers.append("Set-Cookie", buildClearSessionCookie(isSecureRequest(request)))
  return headers
}

async function recoverInvalidSession(
  request: Request,
  pathname: string,
  pathWithQuery: string
): Promise<Response> {
  if (!isAnonymousAllowed(request.method, pathname)) {
    return new Response("Unauthorized", {
      status: 401,
      headers: clearSessionHeaders(request),
    })
  }

  const response = await forward(request, readonlyToken(), pathWithQuery)
  return responseWithHeaders(response, clearSessionHeaders(request, new Headers(response.headers)))
}

export async function handleApiProxy(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const pathWithQuery = url.pathname + url.search
  const userToken = readSessionToken(request)

  if (userToken) {
    const sessionToken = await resolveSessionToken(userToken)
    if (sessionToken.state === "invalid") {
      return recoverInvalidSession(request, url.pathname, pathWithQuery)
    }

    const res = await forward(request, sessionToken.token, pathWithQuery)
    if (res.status === 401) {
      await res.body?.cancel()
      return recoverInvalidSession(request, url.pathname, pathWithQuery)
    }

    // Build a fresh Response so we can mutate headers (forwarded Response headers
    // may be immutable in some runtimes).
    const outHeaders = new Headers(res.headers)
    outHeaders.set("Cache-Control", "private, no-store")
    if (sessionToken.state === "refreshed") {
      outHeaders.append(
        "Set-Cookie",
        buildSessionSetCookie(sessionToken.token, isSecureRequest(request))
      )
    }
    return responseWithHeaders(res, outHeaders)
  }

  if (!isAnonymousAllowed(request.method, url.pathname)) {
    return new Response("Forbidden", { status: 403 })
  }
  return forward(request, readonlyToken(), pathWithQuery)
}
