import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

import { parseCookie, serializeCookie } from "./cookies"
import { sessionSecret } from "./env"

const ALGO = "aes-256-gcm"
const IV_LEN = 12
const TAG_LEN = 16
export const SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 14
const SESSION_PURPOSE = "session"

const COOKIE_MAX_AGE_SECONDS = SESSION_LIFETIME_SECONDS

export type Session = { token: string; authenticatedAt: number; expired: boolean }

export function nowInSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

function key(): Buffer {
  return createHash("sha256").update(sessionSecret()).digest()
}

export function sealJson(value: unknown, purpose = ""): string {
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGO, key(), iv)
  if (purpose) cipher.setAAD(Buffer.from(purpose, "utf8"))
  const enc = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString("base64url")
}

export function unsealJson(sealed: string, purpose = ""): unknown {
  try {
    const raw = Buffer.from(sealed, "base64url")
    if (raw.length < IV_LEN + TAG_LEN) return null
    const iv = raw.subarray(0, IV_LEN)
    const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN)
    const enc = raw.subarray(IV_LEN + TAG_LEN)
    const decipher = createDecipheriv(ALGO, key(), iv)
    if (purpose) decipher.setAAD(Buffer.from(purpose, "utf8"))
    decipher.setAuthTag(tag)
    return JSON.parse(Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8"))
  } catch {
    return null
  }
}

export function sealSession(token: string, authenticatedAt = nowInSeconds()): string {
  return sealJson({ t: token, a: authenticatedAt }, SESSION_PURPOSE)
}

function openSession(sealed: string): Session | null {
  const parsed = unsealJson(sealed, SESSION_PURPOSE) as { t?: unknown; a?: unknown } | null
  if (typeof parsed?.t !== "string") return null
  const authenticatedAt = typeof parsed.a === "number" ? parsed.a : 0
  return {
    token: parsed.t,
    authenticatedAt,
    expired: nowInSeconds() - authenticatedAt >= SESSION_LIFETIME_SECONDS,
  }
}

function usableToken(session: Session | null): string | null {
  return session && !session.expired ? session.token : null
}

export function unsealSession(sealed: string): string | null {
  return usableToken(openSession(sealed))
}

export type JwtTiming = { exp: number; iat: number | null }

function decodeJwtClaims(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1]
    if (!payload) return null
    const parsed: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

export function decodeJwtTiming(token: string): JwtTiming | null {
  const claims = decodeJwtClaims(token)
  if (!claims || typeof claims.exp !== "number") return null
  return { exp: claims.exp, iat: typeof claims.iat === "number" ? claims.iat : null }
}

export function decodeJwtSubject(token: string): string | null {
  const claims = decodeJwtClaims(token)
  return typeof claims?.sub === "string" && claims.sub ? claims.sub : null
}

export function isSecureRequest(request: Request): boolean {
  return request.headers.get("x-forwarded-proto") === "https"
}

export function SESSION_COOKIE_NAME(secure: boolean): string {
  return secure ? "__Host-manaaki_session" : "manaaki_session"
}

export function readSession(request: Request): Session | null {
  const secure = isSecureRequest(request)
  const sealed = parseCookie(request.headers.get("cookie"), SESSION_COOKIE_NAME(secure))
  return sealed ? openSession(sealed) : null
}

export function readSessionToken(request: Request): string | null {
  return usableToken(readSession(request))
}

export function hasLiveSession(request: Request): boolean {
  const token = readSessionToken(request)
  if (!token) return false
  const timing = decodeJwtTiming(token)
  return timing === null || timing.exp > nowInSeconds()
}

export function buildSessionSetCookie(
  token: string,
  secure: boolean,
  authenticatedAt = nowInSeconds()
): string {
  return serializeCookie(SESSION_COOKIE_NAME(secure), sealSession(token, authenticatedAt), {
    maxAge: COOKIE_MAX_AGE_SECONDS,
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
  })
}

export function buildClearSessionCookie(secure: boolean): string {
  return serializeCookie(SESSION_COOKIE_NAME(secure), "", {
    maxAge: 0,
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
  })
}
