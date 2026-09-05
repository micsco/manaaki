// Anonymous users ride the shared read-only token, so this is security-critical:
// GET-only, recipe-browsing surface. Login starts at manaaki's own /api/auth/oauth
// route, so no Mealie auth endpoint needs to be reachable anonymously. No meal plans.
const ALLOWED_GET_PREFIXES = ["/api/recipes", "/api/media/recipes/"]
const ALLOWED_GET_EXACT = new Set(["/api/users/self"])

export function isAnonymousAllowed(method: string, pathname: string): boolean {
  if (method.toUpperCase() !== "GET") return false
  if (ALLOWED_GET_EXACT.has(pathname)) return true
  return ALLOWED_GET_PREFIXES.some(p => {
    if (pathname === p) return true
    if (p.endsWith("/")) return pathname.startsWith(p)
    return pathname.startsWith(`${p}/`)
  })
}
