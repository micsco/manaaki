import { validate as isUuid } from "uuid"

const NUMBER = /^\d+$/

const PAGE_ROOTS = new Set([
  "",
  "api",
  "llms.txt",
  "login",
  "plan",
  "recipes",
  "robots.txt",
  "share",
  "shopping",
  "sitemap.xml",
  "_serverFn",
])
const MEALIE_RECIPE_COLLECTIONS = new Set([
  "bulk-actions",
  "create",
  "exports",
  "shared",
  "suggestions",
  "test-scrape-url",
  "timeline",
])

function isId(segment: string): boolean {
  return isUuid(segment) || NUMBER.test(segment)
}

function pageTemplate(segments: string[]): string[] {
  if (segments[0] !== "recipes" || segments.length < 2) return segments
  const [, , second, ...rest] = segments
  if (second === undefined) return ["recipes", "{slug}"]
  const slugSegment = rest.length === 0 && second.endsWith(".md") ? "{slug}.md" : "{slug}"
  return ["recipes", "{id}", slugSegment, ...rest]
}

function apiTemplate(segments: string[]): string[] {
  const named = segments.map(segment => (isId(segment) ? "{id}" : segment))
  if (named[1] === "recipes" && named[2] && !MEALIE_RECIPE_COLLECTIONS.has(named[2])) {
    named[2] = "{slug}"
  }
  return named
}

export const UNMATCHED_ROUTE = "unmatched"

export function routeTemplate(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean)
  if (!PAGE_ROOTS.has(segments[0] ?? "")) return UNMATCHED_ROUTE
  const named = segments[0] === "api" ? apiTemplate(segments) : pageTemplate(segments)
  return `/${named.join("/")}`
}
