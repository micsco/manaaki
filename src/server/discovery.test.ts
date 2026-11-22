import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { encodeRecipeId } from "../utils/recipe"
import {
  formatRobotsTxt,
  formatSitemapXml,
  handleLlmsTxt,
  handleRecipeMarkdownRequest,
  handleRobotsTxt,
  handleSitemapXml,
  prefersMarkdown,
  resetDiscoveryCache,
  resolvePublicOrigin,
} from "./discovery"

const RECIPE_ID = "23762274-fc1b-4ff4-9710-d56b1e39a742"
const ENCODED_ID = encodeRecipeId(RECIPE_ID)

beforeEach(() => {
  process.env.MEALIE_INTERNAL_URL = "http://mealie:9000"
  process.env.MEALIE_READONLY_TOKEN = "ro-token"
  delete process.env.PUBLIC_ORIGIN
  delete process.env.VITE_PUBLIC_APP_URL
  resetDiscoveryCache()
})

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.PUBLIC_ORIGIN
  delete process.env.VITE_PUBLIC_APP_URL
  delete process.env.MEALIE_READ_TIMEOUT_MS
  delete process.env.MEALIE_STALLED_SLOT_HOLD_MS
})

describe("prefersMarkdown", () => {
  it.each([
    [null, false],
    ["*/*", false],
    ["text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", false],
    ["text/html, text/markdown;q=0.8", false],
    ["text/markdown;q=0, */*", false],
    ["text/markdown", true],
    ["text/markdown, text/html;q=0.8", true],
    ["text/markdown, text/html", true],
    ["TEXT/MARKDOWN; charset=utf-8", true],
  ])("returns %s for Accept: %s", (accept, expected) => {
    expect(prefersMarkdown(accept)).toBe(expected)
  })
})

describe("resolvePublicOrigin", () => {
  it("prefers PUBLIC_ORIGIN over request Host header", () => {
    process.env.PUBLIC_ORIGIN = "https://manaaki.example.nz/extra"
    const req = new Request("http://127.0.0.1:3000/robots.txt", {
      headers: { host: "other.example" },
    })
    expect(resolvePublicOrigin(req)).toBe("https://manaaki.example.nz")
  })

  it("uses x-forwarded-proto and host when PUBLIC_ORIGIN is unset", () => {
    const req = new Request("http://127.0.0.1:3000/robots.txt", {
      headers: { host: "manaaki.micsco.nz", "x-forwarded-proto": "https" },
    })
    expect(resolvePublicOrigin(req)).toBe("https://manaaki.micsco.nz")
  })
})

describe("robots.txt and sitemap.xml formatting", () => {
  it("disallows private routes and advertises sitemap in robots.txt", () => {
    const robots = formatRobotsTxt("https://manaaki.micsco.nz")
    expect(robots).toContain("Allow: /recipes")
    expect(robots).toContain("Allow: /llms.txt")
    expect(robots).toContain("Disallow: /plan")
    expect(robots).toContain("Disallow: /shopping")
    expect(robots).toContain("Disallow: /api/")
    expect(robots).toContain("Sitemap: https://manaaki.micsco.nz/sitemap.xml")
  })

  it("escapes XML entities and sets lastmod in sitemap.xml", () => {
    const xml = formatSitemapXml(
      [
        {
          id: RECIPE_ID,
          slug: "mac&cheese",
          updatedAt: "2026-05-03T12:00:00Z",
        },
      ],
      "https://manaaki.micsco.nz"
    )
    expect(xml).toContain("<loc>https://manaaki.micsco.nz/recipes</loc>")
    expect(xml).toContain(
      `<loc>https://manaaki.micsco.nz/recipes/${ENCODED_ID}/mac&amp;cheese</loc>`
    )
    expect(xml).toContain("<lastmod>2026-05-03T12:00:00.000Z</lastmod>")
  })
})

describe("discovery HTTP handlers", () => {
  it("serves robots.txt with text/plain and cache headers", async () => {
    const res = handleRobotsTxt(
      new Request("http://127.0.0.1:3000/robots.txt", {
        headers: { host: "manaaki.micsco.nz", "x-forwarded-proto": "https" },
      })
    )
    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toBe("text/plain; charset=utf-8")
    expect(res.headers.get("Cache-Control")).toContain("max-age=3600")
    expect(await res.text()).toContain("Sitemap: https://manaaki.micsco.nz/sitemap.xml")
  })

  it("paginates Mealie once and reuses the in-memory cache across sitemap.xml and llms.txt", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(input => {
      const rawUrl =
        input instanceof Request ? input.url : input instanceof URL ? input.href : input
      const url = new URL(rawUrl)
      const page = url.searchParams.get("page")
      if (page === "1") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              page: 1,
              total_pages: 2,
              items: [
                {
                  id: RECIPE_ID,
                  name: "Swedish Meatballs",
                  slug: "swedish-meatballs",
                  updatedAt: "2026-05-02T09:34:27Z",
                },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        )
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            page: 2,
            total_pages: 2,
            items: [
              {
                id: "6c436b4e-8d2e-4669-9342-ec6ec931ba73",
                name: "Baked Cod",
                slug: "baked-cod",
                updatedAt: "2026-05-03T09:34:27Z",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    })

    const sitemapRes = await handleSitemapXml(
      new Request("http://127.0.0.1:3000/sitemap.xml", {
        headers: { host: "manaaki.micsco.nz", "x-forwarded-proto": "https" },
      })
    )
    expect(sitemapRes.status).toBe(200)
    expect(sitemapRes.headers.get("Content-Type")).toBe("application/xml; charset=utf-8")
    const xml = await sitemapRes.text()
    expect(xml).toContain("swedish-meatballs")
    expect(xml).toContain("baked-cod")
    expect(fetchSpy).toHaveBeenCalledTimes(2)

    const llmsRes = await handleLlmsTxt(
      new Request("http://127.0.0.1:3000/llms.txt", {
        headers: { host: "manaaki.micsco.nz", "x-forwarded-proto": "https" },
      })
    )
    expect(llmsRes.status).toBe(200)
    expect(llmsRes.headers.get("Content-Type")).toBe("text/plain; charset=utf-8")
    const llms = await llmsRes.text()
    expect(llms).toContain("[Swedish Meatballs]")
    expect(llms).toContain("[Baked Cod]")
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it("returns 502 when Mealie fails and no cached recipe list exists", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("err", { status: 500 }))
    const res = await handleLlmsTxt(new Request("https://manaaki.micsco.nz/llms.txt"))
    expect(res.status).toBe(502)
    expect(res.headers.get("Cache-Control")).toBe("no-store")
  })
})

describe("handleRecipeMarkdownRequest", () => {
  it("returns null for normal HTML requests so TanStack Start falls through to SSR", async () => {
    const res = await handleRecipeMarkdownRequest(
      new Request(`https://manaaki.micsco.nz/recipes/${ENCODED_ID}/swedish-meatballs`, {
        headers: { Accept: "text/html,application/xhtml+xml,*/*;q=0.8" },
      }),
      { id: ENCODED_ID, slug: "swedish-meatballs" }
    )

    expect(res).toBeNull()
  })

  it("serves Markdown for .md URLs", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: RECIPE_ID,
          name: "Swedish Meatballs",
          slug: "swedish-meatballs",
          recipeIngredient: [{ display: "500g beef mince" }],
          recipeInstructions: [{ text: "Roll into balls and bake." }],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    )

    const res = await handleRecipeMarkdownRequest(
      new Request(`https://manaaki.micsco.nz/recipes/${ENCODED_ID}/swedish-meatballs.md`, {
        headers: { host: "manaaki.micsco.nz", "x-forwarded-proto": "https" },
      }),
      { id: ENCODED_ID, slug: "swedish-meatballs.md" }
    )

    expect(res).not.toBeNull()
    expect(res!.status).toBe(200)
    expect(res!.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8")
    expect(res!.headers.get("Link")).toBe(
      `<https://manaaki.micsco.nz/recipes/${ENCODED_ID}/swedish-meatballs>; rel="canonical"`
    )
    const body = await res!.text()
    expect(body).toContain("# Swedish Meatballs")
    expect(body).toContain("- 500g beef mince")
    expect(body).toContain("1. Roll into balls and bake.")
  })

  it("serves Markdown when Accept prefers text/markdown", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: RECIPE_ID,
          name: "Swedish Meatballs",
          slug: "swedish-meatballs",
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    )

    const res = await handleRecipeMarkdownRequest(
      new Request(`https://manaaki.micsco.nz/recipes/${ENCODED_ID}/swedish-meatballs`, {
        headers: {
          host: "manaaki.micsco.nz",
          "x-forwarded-proto": "https",
          Accept: "text/markdown, text/html;q=0.5",
        },
      }),
      { id: ENCODED_ID, slug: "swedish-meatballs" }
    )

    expect(res).not.toBeNull()
    expect(res!.status).toBe(200)
    expect(res!.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8")
    expect(res!.headers.get("Vary")).toBe("Accept")
  })

  it("301 redirects stale .md slugs to the canonical .md URL", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: RECIPE_ID,
          name: "Swedish Meatballs",
          slug: "swedish-meatballs",
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    )

    const res = await handleRecipeMarkdownRequest(
      new Request(`https://manaaki.micsco.nz/recipes/${ENCODED_ID}/old-slug.md`),
      { id: ENCODED_ID, slug: "old-slug.md" }
    )

    expect(res!.status).toBe(301)
    expect(res!.headers.get("Location")).toBe(`/recipes/${ENCODED_ID}/swedish-meatballs.md`)
  })

  it("returns 404 for invalid recipe IDs or missing recipes", async () => {
    const invalidRes = await handleRecipeMarkdownRequest(
      new Request("https://manaaki.micsco.nz/recipes/not-a-uuid/foo.md"),
      { id: "not-a-uuid", slug: "foo.md" }
    )
    expect(invalidRes!.status).toBe(404)

    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("Not Found", { status: 404 }))
    const missingRes = await handleRecipeMarkdownRequest(
      new Request(`https://manaaki.micsco.nz/recipes/${ENCODED_ID}/missing.md`),
      { id: ENCODED_ID, slug: "missing.md" }
    )
    expect(missingRes!.status).toBe(404)
  })
})
