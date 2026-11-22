// src/server/proxy.ts
import type http from "node:http"
import { request as httpRequest } from "node:http"
import { request as httpsRequest } from "node:https"
import { Readable } from "node:stream"

import { canonicalizeApiPath, isAnonymousAllowed, isAuthenticatedAllowed } from "./allowlist"
import { mealieInternalUrl, readonlyToken } from "./env"
import type { MealieSlot } from "./mealieLimiter"
import {
  acquireMealieSlot,
  describeMealieCall,
  isMealieOverloaded,
  mealieFetch,
  MealieTimeoutError,
  mealieTimeoutMs,
  MealieUnreachableError,
  recordMealieStatus,
  releaseAfterFailure,
  upstreamFailureResponse,
} from "./mealieUpstream"
import { CLIENT_TELEMETRY_HEADERS } from "./requestTracing"
import {
  buildClearSessionCookie,
  buildSessionSetCookie,
  decodeJwtTiming,
  type JwtTiming,
  isSecureRequest,
  nowInSeconds,
  readSession,
} from "./session"
import { measureServerTiming } from "./timing"

// Tokens minted before Mealie 3.25 carry no iat, so fall back to a final-hour window.
const LEGACY_REFRESH_WINDOW_SECONDS = 60 * 60

const STRIP_REQUEST_HEADERS = new Set([
  "authorization",
  "cookie",
  "host",
  "connection",
  "content-length",
  "forwarded",
  "via",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-real-ip",
  ...CLIENT_TELEMETRY_HEADERS,
])

// node:http does NOT auto-decompress the upstream body (unlike undici/fetch), so
// content-encoding and content-length describe the actual bytes being streamed.
// Pass them through unchanged. Strip hop-by-hop headers and upstream cookies.
const STRIP_RESPONSE_HEADERS = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "proxy-connection",
  "set-cookie",
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

const DATABASE_FREE_PATH_PREFIX = "/api/media/recipes/"

async function forward(
  request: Request,
  token: string,
  canonicalPathname: string,
  pathWithQuery: string
): Promise<Response> {
  const slot = canonicalPathname.startsWith(DATABASE_FREE_PATH_PREFIX)
    ? null
    : await acquireMealieSlot(request.signal)
  try {
    return await send(request, token, pathWithQuery, slot)
  } catch (error) {
    if (slot) releaseAfterFailure(slot, error)
    throw error
  }
}

function send(
  request: Request,
  token: string,
  pathWithQuery: string,
  slot: MealieSlot | null
): Promise<Response> {
  const base = new URL(mealieInternalUrl())
  const isHttps = base.protocol === "https:"
  const transport = isHttps ? httpsRequest : httpRequest
  const hasBody = request.method !== "GET" && request.method !== "HEAD"

  return measureServerTiming("mealie", () => {
    const span = describeMealieCall(request.method, new URL(pathWithQuery, base).pathname)
    return new Promise<Response>((resolve, reject) => {
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
          clearTimeout(responseDeadline)
          slot?.release()
          const headers = buildResponseHeaders(res)
          const status = res.statusCode ?? 502
          recordMealieStatus(span, status)
          const noBody = status === 204 || status === 304 || request.method === "HEAD"
          if (noBody) res.resume()
          resolve(
            new Response(noBody ? null : (Readable.toWeb(res) as ReadableStream), {
              status,
              statusText: res.statusMessage,
              headers,
            })
          )
        }
      )
      const responseDeadline = setTimeout(
        () => upstream.destroy(new MealieTimeoutError("Mealie did not answer in time")),
        mealieTimeoutMs(request.method)
      )
      const abandon = () => upstream.destroy(new Error("Client disconnected"))
      if (request.signal.aborted) abandon()
      else request.signal.addEventListener("abort", abandon, { once: true })
      upstream.on("error", error => {
        clearTimeout(responseDeadline)
        reject(
          error instanceof MealieTimeoutError || request.signal.aborted
            ? error
            : new MealieUnreachableError("Mealie could not be reached", { cause: error })
        )
      })
      if (hasBody && request.body) {
        // @ts-expect-error ReadableStream<Uint8Array> is compatible but types diverge
        Readable.fromWeb(request.body).pipe(upstream)
      } else {
        upstream.end()
      }
    })
  })
}

function isPastRefreshPoint({ exp, iat }: JwtTiming, now: number): boolean {
  if (iat === null) return exp - now <= LEGACY_REFRESH_WINDOW_SECONDS
  return now >= iat + (exp - iat) / 2
}

const refreshesInFlight = new Map<string, Promise<SessionToken>>()

async function resolveSessionToken(token: string): Promise<SessionToken> {
  const timing = decodeJwtTiming(token)
  if (timing === null) return { state: "valid", token }
  const now = nowInSeconds()
  if (timing.exp <= now) return { state: "invalid" }
  if (!isPastRefreshPoint(timing, now)) return { state: "valid", token }

  const inFlight = refreshesInFlight.get(token)
  if (inFlight) return inFlight
  const refresh = refreshSessionToken(token).finally(() => refreshesInFlight.delete(token))
  refreshesInFlight.set(token, refresh)
  return refresh
}

async function refreshSessionToken(token: string): Promise<SessionToken> {
  try {
    const res = await measureServerTiming("session_refresh", () =>
      mealieFetch(`${mealieInternalUrl()}/api/auth/refresh`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
    )
    if (res.status === 401) return { state: "invalid" }
    if (!res.ok) return { state: "valid", token }
    const body = (await res.json()) as { access_token?: string }
    return typeof body.access_token === "string"
      ? { state: "refreshed", token: body.access_token }
      : { state: "valid", token }
  } catch (error) {
    if (isMealieOverloaded(error)) throw error
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
  canonicalPathname: string,
  pathWithQuery: string
): Promise<Response> {
  if (!isAnonymousAllowed(request.method, canonicalPathname)) {
    return new Response("Unauthorized", {
      status: 401,
      headers: clearSessionHeaders(request),
    })
  }

  const response = await forward(request, readonlyToken(), canonicalPathname, pathWithQuery)
  return responseWithHeaders(response, clearSessionHeaders(request, new Headers(response.headers)))
}

export async function handleApiProxy(request: Request): Promise<Response> {
  try {
    return await proxyToMealie(request)
  } catch (error) {
    if (request.signal.aborted) return new Response(null, { status: 499 })
    const failure = upstreamFailureResponse(error)
    if (failure) return failure
    throw error
  }
}

async function proxyToMealie(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const canonicalPathname = canonicalizeApiPath(url.pathname)
  if (!canonicalPathname) {
    return new Response("Bad Request", { status: 400 })
  }
  const pathWithQuery = url.pathname + url.search
  const session = readSession(request)

  if (session) {
    if (!isAuthenticatedAllowed(request.method, url.pathname)) {
      return new Response("Forbidden", { status: 403 })
    }

    const sessionToken = session.expired
      ? ({ state: "invalid" } as const)
      : await resolveSessionToken(session.token)
    if (sessionToken.state === "invalid") {
      return recoverInvalidSession(request, canonicalPathname, pathWithQuery)
    }

    const res = await forward(request, sessionToken.token, canonicalPathname, pathWithQuery)
    if (res.status === 401) {
      await res.body?.cancel()
      return recoverInvalidSession(request, canonicalPathname, pathWithQuery)
    }

    // Build a fresh Response so we can mutate headers (forwarded Response headers
    // may be immutable in some runtimes).
    const outHeaders = new Headers(res.headers)
    outHeaders.set("Cache-Control", "private, no-store")
    if (sessionToken.state === "refreshed") {
      outHeaders.append(
        "Set-Cookie",
        buildSessionSetCookie(sessionToken.token, isSecureRequest(request), session.authenticatedAt)
      )
    }
    return responseWithHeaders(res, outHeaders)
  }

  if (!isAnonymousAllowed(request.method, url.pathname)) {
    return new Response("Forbidden", { status: 403 })
  }
  return forward(request, readonlyToken(), canonicalPathname, pathWithQuery)
}
