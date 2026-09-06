import { cacheGroup, evictionCandidates, RECIPE_FRESH_MS, type CacheEntry } from "./cachePolicy"

declare const __PRECACHE__: string[]
declare const __REVISION__: string

interface ExtendableEvent {
  waitUntil(promise: Promise<unknown>): void
}
interface FetchEvent extends ExtendableEvent {
  request: Request
  respondWith(response: Promise<Response>): void
}
interface WorkerMessage extends ExtendableEvent {
  data: { type?: string }
  ports: MessagePort[]
}
interface WorkerScope {
  location: Location
  clients: {
    claim(): Promise<void>
    matchAll(): Promise<{ postMessage(message: unknown): void }[]>
  }
  skipWaiting(): Promise<void>
  addEventListener(type: "install" | "activate", listener: (event: ExtendableEvent) => void): void
  addEventListener(type: "fetch", listener: (event: FetchEvent) => void): void
  addEventListener(type: "message", listener: (event: WorkerMessage) => void): void
}
const worker = globalThis as unknown as WorkerScope
const precache = typeof __PRECACHE__ === "undefined" ? ["/offline-shell.html"] : __PRECACHE__
const shellCache = `manaaki-shell-${typeof __REVISION__ === "undefined" ? "test" : __REVISION__}`
const sessionCache = "manaaki-session-v1"
const dataPrefix = "manaaki-data-v1-"
const identityUrl = "/api/auth/me"
const indexUrl = "/__manaaki_cache_index__"
let identityPromise: Promise<string | null> | undefined
let generation = 0
let writeQueue: Promise<unknown> = Promise.resolve()

function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(operation, operation)
  writeQueue = next.catch(() => {})
  return next
}

async function notifyClients(type: string) {
  for (const client of await worker.clients.matchAll()) {
    // eslint-disable-next-line unicorn/require-post-message-target-origin -- Client.postMessage has no targetOrigin argument
    client.postMessage({ type })
  }
}

async function clearPrivateData() {
  generation++
  identityPromise = undefined
  await serialize(async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(dataPrefix) || name === sessionCache) await caches.delete(name)
    }
  })
  await notifyClients("ACCOUNT_CHANGED")
}

async function identityResponse(): Promise<Response> {
  const cache = await caches.open(sessionCache)
  let response: Response
  try {
    response = await fetch(identityUrl, { cache: "no-store", signal: AbortSignal.timeout(5000) })
  } catch {
    const cached = await cache.match(identityUrl)
    if (cached) {
      await notifyClients("OFFLINE_FALLBACK")
      return cached
    }
    throw new Error("Account is not available offline")
  }
  if (!response.ok) {
    if (response.status >= 500) {
      const cached = await cache.match(identityUrl)
      if (cached) {
        await notifyClients("OFFLINE_FALLBACK")
        return cached
      }
    }
    return response
  }
  await notifyClients("SERVER_REACHABLE")
  const current = await response.clone().json()
  const old = await cache.match(identityUrl)
  const previous = old ? await old.json() : null
  const scope = (value: typeof current) =>
    `${value?.isAnonymous ? "anonymous" : "user"}:${value?.user?.id ?? "none"}`
  if (previous && scope(previous) !== scope(current)) await clearPrivateData()
  const user = current.user
    ? {
        id: current.user.id,
        username: current.user.username,
        fullName: current.user.fullName,
        groupId: current.user.groupId,
        groupSlug: current.user.groupSlug,
        householdId: current.user.householdId,
      }
    : null
  await (
    await caches.open(sessionCache)
  ).put(identityUrl, Response.json({ user, isAnonymous: current.isAnonymous }))
  identityPromise = Promise.resolve(scope(current))
  return response
}

function identity(): Promise<string | null> {
  identityPromise ??= identityResponse()
    .then(async response => {
      if (!response.ok) return null
      const current = await response.json()
      return `${current.isAnonymous ? "anonymous" : "user"}:${current.user?.id ?? "none"}`
    })
    .catch(() => null)
  return identityPromise
}

async function readIndex(cache: Cache): Promise<CacheEntry[]> {
  const response = await cache.match(indexUrl)
  return response ? response.json() : []
}

async function save(
  cache: Cache,
  request: Request,
  response: Response,
  group: string,
  epoch: number
) {
  if (!response.ok || response.redirected || epoch !== generation) return
  const bytes = (await response.clone().arrayBuffer()).byteLength
  if (bytes > 12 * 1024 * 1024) return
  await serialize(async () => {
    if (epoch !== generation) return
    const entries = await readIndex(cache)
    const previous = entries.find(entry => entry.url === request.url)
    const entry: CacheEntry = {
      url: request.url,
      group,
      bytes,
      hits: previous?.hits ?? 0,
      accessedAt: previous?.accessedAt ?? Date.now(),
      cachedAt: Date.now(),
    }
    const next = entries.filter(item => item.url !== request.url).concat(entry)
    const evicted = new Set(evictionCandidates(next))
    for (const url of evicted) await cache.delete(url)
    if (!evicted.has(request.url)) {
      try {
        await cache.put(request, response)
      } catch {
        for (const item of next.filter(item => item.group === group)) await cache.delete(item.url)
        await cache.put(
          indexUrl,
          Response.json(next.filter(item => !evicted.has(item.url) && item.group !== group))
        )
        return
      }
    }
    await cache.put(indexUrl, Response.json(next.filter(item => !evicted.has(item.url))))
  })
}

async function recordVisit(cache: Cache, group: string, epoch: number) {
  await serialize(async () => {
    if (epoch !== generation) return
    const entries = await readIndex(cache)
    const now = Date.now()
    const last = Math.max(
      0,
      ...entries.filter(entry => entry.group === group).map(entry => entry.accessedAt)
    )
    if (now - last < 30_000) return
    await cache.put(
      indexUrl,
      Response.json(
        entries.map(entry =>
          entry.group === group
            ? { ...entry, hits: Math.min(1000, entry.hits + 1), accessedAt: now }
            : entry
        )
      )
    )
  })
}

async function warmRecipe(cache: Cache, id: string, epoch: number) {
  const request = new Request(
    new URL(`/api/recipes/${encodeURIComponent(id)}`, worker.location.origin)
  )
  let response = await cache.match(request)
  if (!response) {
    response = await fetch(request)
    if (!response.ok) return
    await save(cache, request, response.clone(), `recipe:${id}`, epoch)
  }
  const recipe = await response.json()
  if (!recipe.image || !recipe.id) return
  const imageRequest = new Request(
    new URL(
      `/api/media/recipes/${recipe.id}/images/original.webp?v=${encodeURIComponent(recipe.image)}`,
      worker.location.origin
    )
  )
  if (!(await cache.match(imageRequest))) {
    const image = await fetch(imageRequest)
    await save(cache, imageRequest, image, `recipe:${id}`, epoch)
  }
}

async function warmRelated(cache: Cache, path: string, response: Response, epoch: number) {
  if (!response.ok || epoch !== generation) return
  if (path.startsWith("/api/recipes/")) {
    const recipe = await response.json()
    if (recipe.id) await warmRecipe(cache, recipe.id, epoch)
  } else if (path === "/api/households/mealplans") {
    const plan = await response.json()
    const ids = [
      ...new Set<string>(
        (plan.items ?? []).map((item: { recipeId?: string }) => item.recipeId).filter(Boolean)
      ),
    ].slice(0, 21)
    for (const id of ids) {
      if (epoch !== generation) break
      await warmRecipe(cache, id, epoch).catch(() => {})
    }
  }
}

async function dataResponse(event: FetchEvent, group: string): Promise<Response> {
  const scope = await identity()
  if (!scope) return fetch(event.request)
  const epoch = generation
  const cache = await caches.open(`${dataPrefix}${encodeURIComponent(scope)}`)
  const request = event.request
  const path = new URL(request.url).pathname
  const cached = await cache.match(request)
  const immutable = group.startsWith("recipe:")
  const entry = cached ? (await readIndex(cache)).find(item => item.url === request.url) : undefined
  if (immutable && cached && entry && Date.now() - entry.cachedAt < RECIPE_FRESH_MS) {
    if (path.startsWith("/api/recipes/"))
      event.waitUntil(recordVisit(cache, group, epoch).catch(() => {}))
    return cached
  }
  try {
    const response = await fetch(request, { signal: AbortSignal.timeout(5000) })
    if (response.status >= 500 && cached) return cached
    if (response.ok) {
      const copy = response.clone()
      const related = response.clone()
      event.waitUntil(
        save(cache, request, copy, group, epoch)
          .then(() => warmRelated(cache, path, related, epoch))
          .catch(() => {})
      )
    } else if ([401, 403, 404].includes(response.status)) {
      event.waitUntil(serialize(() => cache.delete(request)))
    }
    return response
  } catch (error) {
    if (cached) {
      await notifyClients("OFFLINE_FALLBACK")
      return cached
    }
    throw error
  }
}

worker.addEventListener("install", event => {
  event.waitUntil(caches.open(shellCache).then(cache => cache.addAll(precache)))
})

worker.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const previous = (await caches.keys()).filter(
        name => name.startsWith("manaaki-shell-") && name !== shellCache
      )
      for (const name of previous.slice(0, -2)) await caches.delete(name)
      await worker.clients.claim()
    })()
  )
})

worker.addEventListener("message", event => {
  if (event.data?.type === "ACTIVATE_UPDATE") event.waitUntil(worker.skipWaiting())
  if (event.data?.type === "CLEAR_PRIVATE_DATA") {
    event.waitUntil(clearPrivateData().then(() => event.ports[0]?.postMessage({ ok: true })))
  }
})

worker.addEventListener("fetch", event => {
  const { request } = event
  const url = new URL(request.url)
  if (url.origin !== worker.location.origin) return
  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    event.respondWith(clearPrivateData().then(() => fetch(request)))
    return
  }
  if (request.method !== "GET") return
  if (url.pathname === identityUrl) {
    event.respondWith(identityResponse())
    return
  }
  if (
    request.mode === "navigate" &&
    !url.pathname.startsWith("/api/") &&
    url.pathname !== "/login"
  ) {
    event.respondWith(
      fetch(request)
        .then(async response => {
          if (response.status < 500) return response
          return (await (await caches.open(shellCache)).match("/offline-shell.html")) ?? response
        })
        .catch(
          async () =>
            (await (await caches.open(shellCache)).match("/offline-shell.html")) ?? Response.error()
        )
    )
    return
  }
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(caches.match(request).then(cached => cached ?? fetch(request)))
    return
  }
  if (precache.includes(url.pathname)) {
    event.respondWith(
      caches
        .open(shellCache)
        .then(async cache => (await cache.match(url.pathname)) ?? fetch(request))
    )
    return
  }
  const group = cacheGroup(url.pathname)
  if (group) event.respondWith(dataResponse(event, group))
})
