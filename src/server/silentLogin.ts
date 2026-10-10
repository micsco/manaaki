import { parseCookie, serializeCookie } from "./cookies"
import { isSecureRequest, readSessionToken, sealJson, unsealJson } from "./session"

const KNOWN_DEVICE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60
const SILENT_ATTEMPT_MAX_AGE_SECONDS = 600
const DEFAULT_RETURN_PATH = "/recipes"
const RETURN_PATH_BASE = "https://return-path.invalid"
const MAX_RETURN_PATH_LENGTH = 2048
// eslint-disable-next-line no-control-regex -- browsers drop tabs and newlines from a redirect target, which turns "/<tab>/host" into "//host"
const CONTROL_CHARACTER_OR_BACKSLASH = /[\u0000-\u001f\u007f\\]/

export type KnownDevice = { email: string }

type HandlerType = "serverFn" | "router"

function knownDeviceCookieName(secure: boolean): string {
  return secure ? "__Host-manaaki_known" : "manaaki_known"
}

function silentAttemptCookieName(secure: boolean): string {
  return secure ? "__Host-manaaki_silent" : "manaaki_silent"
}

function cookieOptions(secure: boolean, maxAge: number) {
  return { maxAge, httpOnly: true, secure, sameSite: "lax" as const, path: "/" }
}

export function buildKnownDeviceSetCookie(email: string, secure: boolean): string {
  return serializeCookie(
    knownDeviceCookieName(secure),
    sealJson({ e: email }),
    cookieOptions(secure, KNOWN_DEVICE_MAX_AGE_SECONDS)
  )
}

export function buildClearKnownDeviceCookie(secure: boolean): string {
  return serializeCookie(knownDeviceCookieName(secure), "", cookieOptions(secure, 0))
}

export function readKnownDevice(request: Request): KnownDevice | null {
  const sealed = parseCookie(
    request.headers.get("cookie"),
    knownDeviceCookieName(isSecureRequest(request))
  )
  if (!sealed) return null
  const parsed = unsealJson(sealed) as { e?: unknown } | null
  return typeof parsed?.e === "string" && parsed.e ? { email: parsed.e } : null
}

export function buildSilentAttemptMarkerCookie(secure: boolean): string {
  return serializeCookie(
    silentAttemptCookieName(secure),
    "1",
    cookieOptions(secure, SILENT_ATTEMPT_MAX_AGE_SECONDS)
  )
}

export function hasRecentSilentAttempt(request: Request): boolean {
  return (
    parseCookie(
      request.headers.get("cookie"),
      silentAttemptCookieName(isSecureRequest(request))
    ) !== undefined
  )
}

function resolveOnSite(candidate: string): string | null {
  if (!candidate.startsWith("/") || candidate.length > MAX_RETURN_PATH_LENGTH) return null
  if (CONTROL_CHARACTER_OR_BACKSLASH.test(candidate)) return null
  if (!URL.canParse(candidate, RETURN_PATH_BASE)) return null
  const resolved = new URL(candidate, RETURN_PATH_BASE)
  if (resolved.origin !== RETURN_PATH_BASE) return null
  if (resolved.pathname.startsWith("//")) return null
  if (resolved.pathname === "/api" || resolved.pathname.startsWith("/api/")) return null
  return resolved.pathname + resolved.search + resolved.hash
}

export function safeReturnPath(candidate: string | null | undefined): string {
  return (candidate && resolveOnSite(candidate)) || DEFAULT_RETURN_PATH
}

function isPageRequest(request: Request, pathname: string): boolean {
  if (request.method !== "GET") return false
  if (!(request.headers.get("accept") ?? "").includes("text/html")) return false
  if (pathname.startsWith("/api/") || pathname === "/login") return false
  const lastSegment = pathname.slice(pathname.lastIndexOf("/") + 1)
  return !lastSegment.includes(".")
}

export function silentLoginRedirect(request: Request): string | null {
  const url = new URL(request.url)
  if (!isPageRequest(request, url.pathname)) return null
  if (readSessionToken(request)) return null
  if (!readKnownDevice(request)) return null
  if (hasRecentSilentAttempt(request)) return null
  const returnTo = encodeURIComponent(url.pathname + url.search)
  return `/api/auth/oauth?silent=1&returnTo=${returnTo}`
}

export function handleSilentLoginRequest(
  request: Request,
  handlerType: HandlerType
): Response | null {
  if (handlerType !== "router") return null
  const location = silentLoginRedirect(request)
  if (!location) return null
  return new Response(null, {
    status: 302,
    headers: { Location: location, "Cache-Control": "no-store" },
  })
}
