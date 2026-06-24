// Anonymous users ride the shared read-only token, so this is security-critical:
// GET-only, recipe-browsing surface plus the OIDC login initiation. No meal plans.
const ALLOWED_GET_PREFIXES = ["/api/recipes", "/api/media/recipes/", "/api/auth/oauth"]
const ALLOWED_GET_EXACT = new Set(["/api/users/self"])

export function isAnonymousAllowed(method: string, pathname: string): boolean {
  if (method.toUpperCase() !== "GET") return false
  if (ALLOWED_GET_EXACT.has(pathname)) return true
  return ALLOWED_GET_PREFIXES.some(
    p => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(p)
  )
}
