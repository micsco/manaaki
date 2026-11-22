import type {
  PaginationBaseRecipeSummary,
  RecipeOutput,
  RecipeSummary,
} from "../api/generated/types.gen"
import { encodeRecipeId, recipeUrl, tryDecodeRecipeId } from "../utils/recipe"
import { formatLlmsTxt, formatRecipeMarkdown } from "../utils/recipeMarkdown"
import { mealieInternalUrl, publicOriginOverride, readonlyToken } from "./env"
import { MealieUnreachableError, mealieFetch, upstreamFailureResponse } from "./mealieUpstream"
import { isSecureRequest } from "./session"

const DEFAULT_PUBLIC_ORIGIN = "https://manaaki.micsco.nz"
const DISCOVERY_CACHE_TTL_MS = 5 * 60 * 1000
const MEALIE_PAGE_SIZE = 100
const MAX_SITEMAP_PAGES = 100
const DISCOVERY_CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=600"

interface RecipeListCache {
  recipes: RecipeSummary[]
  expiresAt: number
}

let cachedRecipeList: RecipeListCache | null = null
let inflightRecipeList: Promise<RecipeSummary[]> | null = null

export function resetDiscoveryCache(): void {
  cachedRecipeList = null
  inflightRecipeList = null
}

export function resolvePublicOrigin(request: Request): string {
  const configured = publicOriginOverride()
  if (configured) return configured

  const host = request.headers.get("host")?.trim()
  if (host && !/[\s/]/.test(host)) {
    return `${isSecureRequest(request) ? "https" : "http"}://${host}`
  }

  const fallback = globalThis.process?.env?.VITE_PUBLIC_APP_URL?.trim()
  if (fallback) {
    try {
      const parsed = new URL(fallback)
      if (parsed.protocol === "https:" || parsed.protocol === "http:") return parsed.origin
    } catch {
      return DEFAULT_PUBLIC_ORIGIN
    }
  }

  return DEFAULT_PUBLIC_ORIGIN
}

function parseQuality(params: string[]): number {
  for (const param of params) {
    const [key, rawValue] = param.split("=").map(part => part.trim())
    if (key.toLowerCase() === "q") {
      if (rawValue === undefined) return 0
      const parsed = Number.parseFloat(rawValue)
      if (!Number.isFinite(parsed) || parsed < 0) return 0
      return Math.min(parsed, 1)
    }
  }
  return 1
}

export function prefersMarkdown(acceptHeader: string | null): boolean {
  if (!acceptHeader) return false
  let markdownQuality = 0
  let htmlQuality = 0

  for (const part of acceptHeader.split(",")) {
    const [rawType, ...params] = part.split(";").map(segment => segment.trim())
    const mediaType = rawType.toLowerCase()
    if (!mediaType) continue
    const quality = parseQuality(params)
    if (mediaType === "text/markdown" && quality > markdownQuality) {
      markdownQuality = quality
    } else if (mediaType === "text/html" && quality > htmlQuality) {
      htmlQuality = quality
    }
  }

  return markdownQuality > 0 && markdownQuality >= htmlQuality
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function parseLastMod(
  recipe: Pick<RecipeSummary, "updatedAt" | "dateUpdated" | "dateAdded">
): string | null {
  const candidate = recipe.updatedAt || recipe.dateUpdated || recipe.dateAdded
  if (!candidate) return null
  const timestamp = Date.parse(candidate)
  if (Number.isNaN(timestamp)) return null
  return new Date(timestamp).toISOString()
}

export function formatRobotsTxt(origin: string): string {
  const baseOrigin = origin.replace(/\/+$/, "")
  return [
    "User-agent: *",
    "Allow: /recipes",
    "Allow: /llms.txt",
    "Allow: /api/media/recipes/",
    "Disallow: /plan",
    "Disallow: /shopping",
    "Disallow: /login",
    "Disallow: /share",
    "Disallow: /api/",
    "",
    `Sitemap: ${baseOrigin}/sitemap.xml`,
    "",
  ].join("\n")
}

export function formatSitemapXml(recipes: RecipeSummary[], origin: string): string {
  const baseOrigin = origin.replace(/\/+$/, "")
  const entries: { loc: string; lastmod: string | null }[] = []
  let latestMod: string | null = null

  for (const recipe of recipes) {
    if (!recipe.id || !recipe.slug) continue
    const lastmod = parseLastMod(recipe)
    if (lastmod && (!latestMod || lastmod > latestMod)) {
      latestMod = lastmod
    }
    entries.push({
      loc: `${baseOrigin}${recipeUrl(recipe.id, recipe.slug)}`,
      lastmod,
    })
  }

  const allEntries = [{ loc: `${baseOrigin}/recipes`, lastmod: latestMod }, ...entries]
  const body = allEntries
    .map(entry => {
      const locTag = `<loc>${escapeXml(entry.loc)}</loc>`
      const modTag = entry.lastmod ? `<lastmod>${escapeXml(entry.lastmod)}</lastmod>` : ""
      return `  <url>${locTag}${modTag}</url>`
    })
    .join("\n")

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    body,
    "</urlset>",
    "",
  ].join("\n")
}

async function fetchMealieRecipesPage(page: number): Promise<PaginationBaseRecipeSummary> {
  const url = new URL("/api/recipes", mealieInternalUrl())
  url.searchParams.set("perPage", String(MEALIE_PAGE_SIZE))
  url.searchParams.set("page", String(page))
  url.searchParams.set("orderBy", "name")
  url.searchParams.set("orderDirection", "asc")

  let response: Response
  try {
    response = await mealieFetch(url, {
      headers: {
        Authorization: `Bearer ${readonlyToken()}`,
        Accept: "application/json",
      },
    })
  } catch (error) {
    if (upstreamFailureResponse(error)) throw error
    throw new MealieUnreachableError("Mealie recipe list lookup failed", { cause: error })
  }

  if (!response.ok) {
    throw new MealieUnreachableError(`Mealie recipe list returned ${response.status}`)
  }

  return (await response.json()) as PaginationBaseRecipeSummary
}

async function loadAllPublicRecipes(): Promise<RecipeSummary[]> {
  const first = await fetchMealieRecipesPage(1)
  const totalPages = Math.min(first.total_pages ?? 1, MAX_SITEMAP_PAGES)
  if (totalPages <= 1) return first.items ?? []

  const remaining = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) => fetchMealieRecipesPage(index + 2))
  )
  return [...(first.items ?? []), ...remaining.flatMap(page => page.items ?? [])]
}

async function getCachedPublicRecipes(now = Date.now()): Promise<RecipeSummary[]> {
  if (cachedRecipeList && cachedRecipeList.expiresAt > now) {
    return cachedRecipeList.recipes
  }

  inflightRecipeList ??= loadAllPublicRecipes()
    .then(recipes => {
      cachedRecipeList = { recipes, expiresAt: Date.now() + DISCOVERY_CACHE_TTL_MS }
      return recipes
    })
    .finally(() => {
      inflightRecipeList = null
    })

  try {
    return await inflightRecipeList
  } catch (error) {
    if (cachedRecipeList) return cachedRecipeList.recipes
    throw error
  }
}

async function fetchPublicRecipe(uuid: string): Promise<RecipeOutput | null> {
  const url = new URL(`/api/recipes/${encodeURIComponent(uuid)}`, mealieInternalUrl())

  let response: Response
  try {
    response = await mealieFetch(url, {
      headers: {
        Authorization: `Bearer ${readonlyToken()}`,
        Accept: "application/json",
      },
    })
  } catch (error) {
    if (upstreamFailureResponse(error)) throw error
    throw new MealieUnreachableError("Mealie recipe lookup failed", { cause: error })
  }

  if (response.status === 404) return null
  if (!response.ok) {
    throw new MealieUnreachableError(`Mealie recipe returned ${response.status}`)
  }

  return (await response.json()) as RecipeOutput
}

export function handleRobotsTxt(request: Request): Response {
  const origin = resolvePublicOrigin(request)
  return new Response(formatRobotsTxt(origin), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  })
}

export async function handleSitemapXml(request: Request): Promise<Response> {
  const origin = resolvePublicOrigin(request)
  try {
    const recipes = await getCachedPublicRecipes()
    return new Response(formatSitemapXml(recipes, origin), {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": DISCOVERY_CACHE_CONTROL,
      },
    })
  } catch (error) {
    const failure = upstreamFailureResponse(error)
    if (failure) return failure
    throw error
  }
}

export async function handleLlmsTxt(request: Request): Promise<Response> {
  const origin = resolvePublicOrigin(request)
  try {
    const recipes = await getCachedPublicRecipes()
    return new Response(formatLlmsTxt(recipes, origin), {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": DISCOVERY_CACHE_CONTROL,
      },
    })
  } catch (error) {
    const failure = upstreamFailureResponse(error)
    if (failure) return failure
    throw error
  }
}

export async function handleRecipeMarkdownRequest(
  request: Request,
  params: { id: string; slug: string }
): Promise<Response | null> {
  const isMarkdownPath = params.slug.endsWith(".md")
  const wantsMarkdown = isMarkdownPath || prefersMarkdown(request.headers.get("accept"))

  if (!wantsMarkdown) return null

  const uuid = tryDecodeRecipeId(params.id)
  if (!uuid) {
    return new Response("Recipe not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    })
  }

  let recipe: RecipeOutput | null
  try {
    recipe = await fetchPublicRecipe(uuid)
  } catch (error) {
    const failure = upstreamFailureResponse(error)
    if (failure) return failure
    throw error
  }

  if (!recipe) {
    return new Response("Recipe not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    })
  }

  const requestedSlug = isMarkdownPath ? params.slug.slice(0, -3) : params.slug
  if (recipe.id && recipe.slug && requestedSlug !== recipe.slug) {
    const canonicalPath = `/recipes/${encodeRecipeId(recipe.id)}/${recipe.slug}${isMarkdownPath ? ".md" : ""}`
    const headers = new Headers({ Location: canonicalPath })
    if (!isMarkdownPath) headers.set("Vary", "Accept")
    return new Response(null, { status: 301, headers })
  }

  const origin = resolvePublicOrigin(request)
  const markdown = formatRecipeMarkdown(recipe, origin)
  const headers = new Headers({
    "Content-Type": "text/markdown; charset=utf-8",
    "Cache-Control": DISCOVERY_CACHE_CONTROL,
    Vary: "Accept",
  })

  if (recipe.id && recipe.slug) {
    headers.set("Link", `<${origin}${recipeUrl(recipe.id, recipe.slug)}>; rel="canonical"`)
  }

  return new Response(markdown, { status: 200, headers })
}
