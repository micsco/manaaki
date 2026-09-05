import { createHash, randomBytes, timingSafeEqual } from "node:crypto"

import { parseCookie, serializeCookie } from "./cookies"
import { mealieInternalUrl } from "./env"
import { isSecureRequest, sealJson, unsealJson } from "./session"
import { buildSilentAttemptMarkerCookie, readKnownDevice, safeReturnPath } from "./silentLogin"

const ATTEMPT_MAX_AGE_SECONDS = 600

export type LoginAttempt = {
  state: string
  nonce: string
  codeVerifier: string
  redirectUri: string
  returnTo: string
  silent: boolean
}

type ProviderConfig = {
  authorization_endpoint: string
  client_id: string
  scope: string
}

function attemptCookieName(secure: boolean): string {
  return secure ? "__Host-manaaki_oidc" : "manaaki_oidc"
}

function attemptCookieOptions(secure: boolean, maxAge: number) {
  return { maxAge, httpOnly: true, secure, sameSite: "lax" as const, path: "/" }
}

async function fetchProviderConfig(): Promise<ProviderConfig> {
  const res = await fetch(`${mealieInternalUrl()}/api/auth/oauth/native/config`)
  if (!res.ok) throw new Error(`OIDC provider config unavailable: ${res.status}`)
  return (await res.json()) as ProviderConfig
}

function publicOrigin(request: Request): string {
  const host = request.headers.get("host")
  if (!host) throw new Error("Missing Host header")
  return `${isSecureRequest(request) ? "https" : "http"}://${host}`
}

function codeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url")
}

function equalStates(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

export async function beginNativeLogin(request: Request): Promise<Response> {
  const config = await fetchProviderConfig()
  const params = new URL(request.url).searchParams
  const silent = params.get("silent") === "1"
  const attempt: LoginAttempt = {
    state: randomBytes(16).toString("base64url"),
    nonce: randomBytes(16).toString("base64url"),
    codeVerifier: randomBytes(32).toString("base64url"),
    redirectUri: `${publicOrigin(request)}/login`,
    returnTo: safeReturnPath(params.get("returnTo")),
    silent,
  }

  const authorize = new URL(config.authorization_endpoint)
  authorize.searchParams.set("response_type", "code")
  authorize.searchParams.set("client_id", config.client_id)
  authorize.searchParams.set("redirect_uri", attempt.redirectUri)
  authorize.searchParams.set("scope", config.scope)
  authorize.searchParams.set("state", attempt.state)
  authorize.searchParams.set("nonce", attempt.nonce)
  authorize.searchParams.set("code_challenge", codeChallenge(attempt.codeVerifier))
  authorize.searchParams.set("code_challenge_method", "S256")
  if (silent) {
    authorize.searchParams.set("prompt", "none")
    const known = readKnownDevice(request)
    if (known) authorize.searchParams.set("login_hint", known.email)
  }

  const secure = isSecureRequest(request)
  const headers = new Headers({ Location: authorize.toString(), "Cache-Control": "no-store" })
  headers.append(
    "Set-Cookie",
    serializeCookie(
      attemptCookieName(secure),
      sealJson(attempt),
      attemptCookieOptions(secure, ATTEMPT_MAX_AGE_SECONDS)
    )
  )
  if (silent) headers.append("Set-Cookie", buildSilentAttemptMarkerCookie(secure))
  return new Response(null, { status: 302, headers })
}

export function readLoginAttempt(request: Request): LoginAttempt | null {
  const sealed = parseCookie(
    request.headers.get("cookie"),
    attemptCookieName(isSecureRequest(request))
  )
  if (!sealed) return null
  const parsed = unsealJson(sealed) as Partial<LoginAttempt> | null
  if (
    !parsed ||
    typeof parsed.state !== "string" ||
    typeof parsed.nonce !== "string" ||
    typeof parsed.codeVerifier !== "string" ||
    typeof parsed.redirectUri !== "string"
  ) {
    return null
  }
  return {
    state: parsed.state,
    nonce: parsed.nonce,
    codeVerifier: parsed.codeVerifier,
    redirectUri: parsed.redirectUri,
    returnTo: safeReturnPath(typeof parsed.returnTo === "string" ? parsed.returnTo : null),
    silent: parsed.silent === true,
  }
}

export function buildClearLoginAttemptCookie(secure: boolean): string {
  return serializeCookie(attemptCookieName(secure), "", attemptCookieOptions(secure, 0))
}

export async function completeNativeLogin(request: Request): Promise<string> {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  if (!code || !state) throw new Error("Missing code/state")

  const attempt = readLoginAttempt(request)
  if (!attempt) throw new Error("No login attempt in progress")
  if (!equalStates(attempt.state, state)) throw new Error("OIDC state mismatch")

  const res = await fetch(`${mealieInternalUrl()}/api/auth/oauth/native/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      code_verifier: attempt.codeVerifier,
      redirect_uri: attempt.redirectUri,
      nonce: attempt.nonce,
    }),
  })
  if (!res.ok) throw new Error(`OIDC token exchange failed: ${res.status}`)
  const body = (await res.json()) as { access_token?: unknown }
  if (typeof body.access_token !== "string")
    throw new Error("OIDC token exchange returned no access_token")
  return body.access_token
}
