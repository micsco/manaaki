export function parseCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined
  for (const part of header.split(";")) {
    const eq = part.indexOf("=")
    if (eq === -1) continue
    const key = part.slice(0, eq).trim()
    if (key === name) {
      return decodeURIComponent(part.slice(eq + 1).trim())
    }
  }
  return undefined
}

export function serializeCookie(
  name: string,
  value: string,
  opts: {
    maxAge?: number
    httpOnly?: boolean
    secure?: boolean
    sameSite?: "lax" | "strict" | "none"
    path?: string
  } = {}
): string {
  const segments = [`${name}=${encodeURIComponent(value)}`]
  if (opts.path) segments.push(`Path=${opts.path}`)
  if (opts.maxAge !== undefined) segments.push(`Max-Age=${Math.floor(opts.maxAge)}`)
  if (opts.httpOnly) segments.push("HttpOnly")
  if (opts.secure) segments.push("Secure")
  if (opts.sameSite) {
    const v = opts.sameSite[0].toUpperCase() + opts.sameSite.slice(1)
    segments.push(`SameSite=${v}`)
  }
  return segments.join("; ")
}
