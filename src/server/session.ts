import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"
import { parseCookie, serializeCookie } from "./cookies"
import { sessionSecret } from "./env"

const ALGO = "aes-256-gcm"
const IV_LEN = 12
const TAG_LEN = 16
// Default cookie lifetime cap (seconds); Mealie's own JWT exp governs real validity.
const MAX_AGE = 60 * 60 * 24 * 14

function key(): Buffer {
  // Derive a fixed 32-byte key from any-length secret.
  return createHash("sha256").update(sessionSecret()).digest()
}

export function sealSession(token: string): string {
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGO, key(), iv)
  const enc = Buffer.concat([cipher.update(JSON.stringify({ t: token }), "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString("base64url")
}

export function unsealSession(sealed: string): string | null {
  try {
    const raw = Buffer.from(sealed, "base64url")
    if (raw.length < IV_LEN + TAG_LEN) return null
    const iv = raw.subarray(0, IV_LEN)
    const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN)
    const enc = raw.subarray(IV_LEN + TAG_LEN)
    const decipher = createDecipheriv(ALGO, key(), iv)
    decipher.setAuthTag(tag)
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8")
    const parsed = JSON.parse(dec) as { t?: unknown }
    return typeof parsed.t === "string" ? parsed.t : null
  } catch {
    return null
  }
}

export function decodeJwtExp(token: string): number | null {
  try {
    const payload = token.split(".")[1]
    if (!payload) return null
    const json = Buffer.from(payload, "base64url").toString("utf8")
    const claims = JSON.parse(json) as { exp?: unknown }
    return typeof claims.exp === "number" ? claims.exp : null
  } catch {
    return null
  }
}

export function isSecureRequest(request: Request): boolean {
  return request.headers.get("x-forwarded-proto") === "https"
}

export function SESSION_COOKIE_NAME(secure: boolean): string {
  return secure ? "__Host-manaaki_session" : "manaaki_session"
}

export function readSessionToken(request: Request): string | null {
  const secure = isSecureRequest(request)
  const sealed = parseCookie(request.headers.get("cookie"), SESSION_COOKIE_NAME(secure))
  return sealed ? unsealSession(sealed) : null
}

export function buildSessionSetCookie(token: string, secure: boolean): string {
  return serializeCookie(SESSION_COOKIE_NAME(secure), sealSession(token), {
    maxAge: MAX_AGE,
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
