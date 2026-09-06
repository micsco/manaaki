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

async function request(
  path: string,
  options?: {
    method?: string
    navigate?: boolean
    body?: unknown
    headers?: Record<string, string>
  }
) {
  const pending: Promise<unknown>[] = []
  let response: Promise<Response> | undefined
  const req = new Request(`${origin}${path}`, {
    method: options?.method ?? "GET",
    headers: options?.headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  })
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

async function seedShopping() {
  await request("/api/auth/me")
  fetchMock.mockResolvedValueOnce(
    Response.json({
      id: "list",
      listItems: [{ id: "item", shoppingListId: "list", checked: false, display: "Eggs" }],
    })
  )
  await request("/api/households/shopping/lists/list")
}

async function checkItem(checked: boolean) {
  return request("/api/households/shopping/items/item", {
    method: "PUT",
    headers: { "X-Manaaki-Offline-Action": "shopping-check" },
    body: { shoppingListId: "list", checked },
  })
}

async function syncShopping() {
  const pending: Promise<unknown>[] = []
  listeners.get("message")?.({
    data: { type: "SYNC_SHOPPING" },
    waitUntil: (promise: Promise<unknown>) => pending.push(promise),
  })
  await Promise.all(pending)
}

it("persists offline check-offs and overlays them on the cached list", async () => {
  await seedShopping()
  offline = true
  expect((await checkItem(true))?.status).toBe(202)
  expect(await (await request("/api/households/shopping/lists/list"))?.json()).toMatchObject({
    listItems: [{ checked: true }],
  })
  expect((await checkItem(false))?.status).toBe(202)
  expect(await (await request("/api/households/shopping/lists/list"))?.json()).toMatchObject({
    listItems: [{ checked: false }],
  })
})

it("replays the desired check while preserving the latest server fields", async () => {
  await seedShopping()
  offline = true
  await checkItem(true)
  offline = false
  fetchMock.mockImplementation(async (input: string | Request, init?: RequestInit) => {
    if (absolute(input).endsWith("/api/auth/me"))
      return Response.json({ user: { id: account }, isAnonymous: false })
    if (init?.method === "PUT") return Response.json({ updatedItems: [] })
    return Response.json({
      id: "item",
      shoppingListId: "list",
      checked: false,
      display: "Free-range eggs",
      quantity: 12,
    })
  })
  await syncShopping()
  const update = fetchMock.mock.calls.find(call => call[1]?.method === "PUT")
  expect(JSON.parse(update?.[1]?.body as string)).toMatchObject({
    checked: true,
    display: "Free-range eggs",
    quantity: 12,
  })
  offline = true
  const cache = await open("manaaki-data-v1-user%3Aone")
  expect(await (await cache.match("/__manaaki_shopping_outbox__"))?.json()).toEqual([])
  expect(await (await cache.match("/api/households/shopping/lists/list"))?.json()).toMatchObject({
    listItems: [{ checked: true }],
  })
})

it("keeps the queue when the server rejects synchronization", async () => {
  await seedShopping()
  offline = true
  await checkItem(true)
  offline = false
  fetchMock.mockImplementation(async (input: string | Request) =>
    absolute(input).endsWith("/api/auth/me")
      ? Response.json({ user: { id: account }, isAnonymous: false })
      : new Response(null, { status: 403 })
  )
  await syncShopping()
  const cache = await open("manaaki-data-v1-user%3Aone")
  expect(await (await cache.match("/__manaaki_shopping_outbox__"))?.json()).toHaveLength(1)
})
