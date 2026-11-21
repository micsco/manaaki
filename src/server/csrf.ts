import { publicOriginOverride } from "./env"
import { isSecureRequest, SESSION_COOKIE_NAME } from "./session"

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])
const ALLOWED_FETCH_SITES = new Set(["same-origin", "none"])

function expectedOrigin(request: Request): string | null {
  const configured = publicOriginOverride()
  if (configured) return configured
  const host = request.headers.get("host")?.trim()
  if (!host) return null
  return `${isSecureRequest(request) ? "https" : "http"}://${host}`
}

function hasSessionCookie(request: Request): boolean {
  const cookie = request.headers.get("cookie")
  if (!cookie) return false
  const name = SESSION_COOKIE_NAME(isSecureRequest(request))
  return cookie.split(";").some(part => part.slice(0, part.indexOf("=")).trim() === name)
}

export function handleCsrfRequest(request: Request): Response | null {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return null

  const secFetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase()
  if (secFetchSite && !ALLOWED_FETCH_SITES.has(secFetchSite)) {
    return new Response("Forbidden", { status: 403, headers: { "Cache-Control": "no-store" } })
  }

  const origin = request.headers.get("origin")?.trim()
  if (origin) {
    const expected = expectedOrigin(request)
    if (!expected || origin !== expected) {
      return new Response("Forbidden", { status: 403, headers: { "Cache-Control": "no-store" } })
    }
    return null
  }

  if (!secFetchSite && hasSessionCookie(request)) {
    return new Response("Forbidden", { status: 403, headers: { "Cache-Control": "no-store" } })
  }

  return null
}
