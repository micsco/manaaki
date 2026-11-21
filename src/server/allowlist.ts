// eslint-disable-next-line no-control-regex -- reject control bytes, backslashes, repeated slashes, and encoded separators before prefix checks
const UNSAFE_RAW_PATH = /[\\\u0000-\u001f\u007f]|\/\/|%2f|%5c|%00/i
// eslint-disable-next-line no-control-regex -- decoded path must also be free of control bytes, backslashes, and repeated slashes
const UNSAFE_DECODED_PATH = /[\\\u0000-\u001f\u007f]|\/\//

const ANONYMOUS_GET_PREFIXES = ["/api/recipes", "/api/media/recipes/"]
const ANONYMOUS_GET_EXACT = new Set(["/api/users/self"])

const AUTHENTICATED_PREFIXES: Record<string, readonly string[]> = {
  GET: [
    "/api/recipes",
    "/api/media/recipes/",
    "/api/households/mealplans",
    "/api/households/shopping/lists",
    "/api/households/shopping/items",
    "/api/foods",
    "/api/units",
    "/api/organizers/tools",
  ],
  POST: [
    "/api/recipes",
    "/api/households/mealplans",
    "/api/households/shopping/lists",
    "/api/households/shopping/items",
    "/api/foods",
    "/api/units",
    "/api/parser/ingredients",
  ],
  PUT: ["/api/recipes/", "/api/households/mealplans/", "/api/households/shopping/items/"],
  PATCH: ["/api/recipes/"],
  DELETE: [
    "/api/households/mealplans/",
    "/api/households/shopping/lists/",
    "/api/households/shopping/items/",
  ],
}

const AUTHENTICATED_EXACT: Record<string, ReadonlySet<string>> = {
  GET: new Set(["/api/users/self"]),
}

function hasDotSegment(path: string): boolean {
  return path.split("/").some(segment => segment === "." || segment === "..")
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  if (pathname === prefix) return true
  if (prefix.endsWith("/")) return pathname.startsWith(prefix) && pathname.length > prefix.length
  return pathname.startsWith(`${prefix}/`)
}

export function canonicalizeApiPath(rawPathname: string): string | null {
  if (!rawPathname.startsWith("/") || UNSAFE_RAW_PATH.test(rawPathname)) return null
  let decoded: string
  try {
    decoded = decodeURIComponent(rawPathname)
  } catch {
    return null
  }
  if (UNSAFE_DECODED_PATH.test(decoded) || hasDotSegment(decoded)) return null
  try {
    const twice = decodeURIComponent(decoded)
    if (twice !== decoded && (UNSAFE_DECODED_PATH.test(twice) || hasDotSegment(twice))) {
      return null
    }
  } catch {
    return null
  }
  return decoded
}

export function isAnonymousAllowed(method: string, pathname: string): boolean {
  if (method.toUpperCase() !== "GET") return false
  const canonical = canonicalizeApiPath(pathname)
  if (!canonical) return false
  if (/^\/api\/recipes\/timeline(?:\/|$)/i.test(canonical)) return false
  if (ANONYMOUS_GET_EXACT.has(canonical)) return true
  return ANONYMOUS_GET_PREFIXES.some(prefix => matchesPrefix(canonical, prefix))
}

export function isAuthenticatedAllowed(method: string, pathname: string): boolean {
  const upperMethod = method.toUpperCase()
  const canonical = canonicalizeApiPath(pathname)
  if (!canonical) return false
  if (AUTHENTICATED_EXACT[upperMethod]?.has(canonical)) return true
  const prefixes = AUTHENTICATED_PREFIXES[upperMethod]
  if (!prefixes) return false
  return prefixes.some(prefix => matchesPrefix(canonical, prefix))
}
