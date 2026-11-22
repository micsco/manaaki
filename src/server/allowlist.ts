// eslint-disable-next-line no-control-regex -- reject control bytes, backslashes, repeated slashes, and encoded separators before prefix checks
const UNSAFE_RAW_PATH = /[\\\u0000-\u001f\u007f]|\/\/|%2f|%5c|%00/i
// eslint-disable-next-line no-control-regex -- decoded path must also be free of control bytes, backslashes, and repeated slashes
const UNSAFE_DECODED_PATH = /[\\\u0000-\u001f\u007f]|\/\//

const SEGMENT = "{}"

const RESERVED_RECIPE_SEGMENTS = new Set([
  "bulk-actions",
  "create",
  "exports",
  "shared",
  "suggestions",
  "test-scrape-url",
  "timeline",
])

const ANONYMOUS_ROUTES: Record<string, readonly string[]> = {
  GET: ["/api/recipes", "/api/recipes/{}", "/api/media/recipes/{}/images/{}"],
}

const AUTHENTICATED_ROUTES: Record<string, readonly string[]> = {
  GET: [
    "/api/recipes",
    "/api/recipes/{}",
    "/api/recipes/timeline/events",
    "/api/media/recipes/{}/images/{}",
    "/api/households/mealplans",
    "/api/households/shopping/lists",
    "/api/households/shopping/lists/{}",
    "/api/households/shopping/items/{}",
    "/api/foods",
    "/api/units",
    "/api/organizers/tools/slug/{}",
  ],
  POST: [
    "/api/recipes/create/url",
    "/api/recipes/{}/duplicate",
    "/api/households/mealplans",
    "/api/households/shopping/lists",
    "/api/households/shopping/lists/{}/recipe",
    "/api/households/shopping/lists/{}/recipe/{}/delete",
    "/api/households/shopping/items/create-bulk",
    "/api/foods",
    "/api/units",
    "/api/parser/ingredients",
  ],
  PUT: ["/api/households/mealplans/{}", "/api/households/shopping/items/{}"],
  PATCH: ["/api/recipes/{}"],
  DELETE: [
    "/api/households/mealplans/{}",
    "/api/households/shopping/lists/{}",
    "/api/households/shopping/items/{}",
  ],
}

function hasDotSegment(path: string): boolean {
  return path.split("/").some(segment => segment === "." || segment === "..")
}

function isRecipeSlug(segments: readonly string[], index: number): boolean {
  return !(
    index === 3 &&
    segments[2] === "recipes" &&
    RESERVED_RECIPE_SEGMENTS.has(segments[index].toLowerCase())
  )
}

function matchesRoute(pathname: string, route: string): boolean {
  const actual = pathname.split("/")
  const expected = route.split("/")
  if (actual.length !== expected.length) return false
  return expected.every((part, index) =>
    part === SEGMENT
      ? actual[index].length > 0 && isRecipeSlug(actual, index)
      : part === actual[index]
  )
}

function isAllowed(routes: Record<string, readonly string[]>, method: string, pathname: string) {
  const canonical = canonicalizeApiPath(pathname)
  if (!canonical) return false
  return (routes[method.toUpperCase()] ?? []).some(route => matchesRoute(canonical, route))
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
  return isAllowed(ANONYMOUS_ROUTES, method, pathname)
}

export function isAuthenticatedAllowed(method: string, pathname: string): boolean {
  return isAllowed(AUTHENTICATED_ROUTES, method, pathname)
}
