import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const origin = "http://localhost:3000"
const absolute = (value: string | Request) =>
  new URL(typeof value === "string" ? value : value.url, origin).href

class MemoryCache {
  values = new Map<string, Response>()
  async match(key: string | Request) {
    return this.values.get(absolute(key))?.clone()
  }
  async put(key: string | Request, response: Response) {
    this.values.set(absolute(key), response.clone())
  }
  async delete(key: string | Request) {
    return this.values.delete(absolute(key))
  }
  async addAll(keys: string[]) {
    for (const key of keys) await this.put(key, new Response("shell"))
  }
}

let stores: Map<string, MemoryCache>
let listeners: Map<string, (event: unknown) => void>
let fetchMock: ReturnType<typeof vi.fn>
let account: string
let offline: boolean

async function open(name: string) {
  if (!stores.has(name)) stores.set(name, new MemoryCache())
  return stores.get(name)!
}

async function request(path: string, options?: { method?: string; navigate?: boolean }) {
  const pending: Promise<unknown>[] = []
  let response: Promise<Response> | undefined
  const req = new Request(`${origin}${path}`, { method: options?.method ?? "GET" })
  if (options?.navigate) Object.defineProperty(req, "mode", { value: "navigate" })
  listeners.get("fetch")?.({
    request: req,
    respondWith: (value: Promise<Response>) => {
      response = value
    },
    waitUntil: (promise: Promise<unknown>) => pending.push(promise),
  })
  const result = await response
  await Promise.all(pending)
  return result
}

beforeEach(async () => {
  vi.resetModules()
  stores = new Map()
  listeners = new Map()
  account = "one"
  offline = false
  vi.stubGlobal("location", new URL(origin))
  vi.stubGlobal("clients", { claim: vi.fn(), matchAll: vi.fn().mockResolvedValue([]) })
  vi.stubGlobal("skipWaiting", vi.fn())
  vi.stubGlobal("addEventListener", (type: string, listener: (event: unknown) => void) =>
    listeners.set(type, listener)
  )
  vi.stubGlobal("caches", {
    open,
    keys: async () => [...stores.keys()],
    delete: async (key: string) => stores.delete(key),
    match: async (key: Request) => {
      for (const cache of stores.values()) {
        const value = await cache.match(key)
        if (value) return value
      }
    },
  })
  fetchMock = vi.fn(async (input: string | Request) => {
    if (offline) throw new TypeError("Offline")
    const path = new URL(absolute(input)).pathname
    if (path === "/api/auth/me")
      return Response.json({ user: { id: account, fullName: "Cook" }, isAnonymous: false })
    if (path === "/api/households/mealplans")
      return Response.json({ items: [{ recipeId: "planned" }] })
    if (path.startsWith("/api/media/")) return new Response("image")
    if (path.startsWith("/api/recipes/"))
      return Response.json({ id: path.split("/").at(-1), name: "Soup", image: "123" })
    return Response.json({ items: [account] })
  })
  vi.stubGlobal("fetch", fetchMock)
  await import("./worker")
})

afterEach(() => vi.unstubAllGlobals())

describe("offline service worker", () => {
  it("automatically caches a recipe and its image for offline visits", async () => {
    await request("/api/recipes/soup")
    offline = true
    expect(await (await request("/api/recipes/soup"))?.json()).toMatchObject({ name: "Soup" })
    expect(
      await (await request("/api/media/recipes/soup/images/original.webp?v=123"))?.text()
    ).toBe("image")
  })

  it("downloads recipes in the meal plan without requiring individual visits", async () => {
    await request("/api/households/mealplans")
    offline = true
    expect(await (await request("/api/recipes/planned"))?.json()).toMatchObject({ name: "Soup" })
  })

  it("refreshes shopping lists online and falls back when offline", async () => {
    await request("/api/households/shopping/lists")
    fetchMock.mockResolvedValueOnce(Response.json({ items: ["fresh"] }))
    expect(await (await request("/api/households/shopping/lists"))?.json()).toEqual({
      items: ["fresh"],
    })
    offline = true
    expect(await (await request("/api/households/shopping/lists"))?.json()).toEqual({
      items: ["fresh"],
    })
  })

  it("does not serve a previous account's data after an account change", async () => {
    await request("/api/households/shopping/lists")
    account = "two"
    await request("/api/auth/me")
    offline = true
    await expect(request("/api/households/shopping/lists")).rejects.toThrow()
    expect([...stores.keys()].some(key => key.endsWith("user%3Aone"))).toBe(false)
  })

  it("clears cached identity and private data on sign out", async () => {
    await request("/api/recipes/soup")
    await request("/api/auth/logout", { method: "POST" })
    offline = true
    await expect(request("/api/auth/me")).rejects.toThrow()
    expect([...stores.keys()].some(key => key.startsWith("manaaki-data"))).toBe(false)
  })

  it("does not intercept mutations, login callbacks, or unapproved APIs", async () => {
    expect(await request("/api/recipes/soup", { method: "PUT" })).toBeUndefined()
    expect(await request("/api/auth/complete?code=secret", { navigate: true })).toBeUndefined()
    expect(await request("/api/users/self")).toBeUndefined()
  })

  it("serves the neutral shell for offline deep links, never cached user HTML", async () => {
    await (
      await open("manaaki-shell-test")
    ).put("/offline-shell.html", new Response("neutral shell"))
    offline = true
    expect(await (await request("/recipes/soup/name?cook=true", { navigate: true }))?.text()).toBe(
      "neutral shell"
    )
  })

  it("does not hide an authorization failure behind cached private data", async () => {
    await request("/api/households/shopping/lists")
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }))
    expect((await request("/api/households/shopping/lists"))?.status).toBe(403)
    offline = true
    await expect(request("/api/households/shopping/lists")).rejects.toThrow()
  })
})
