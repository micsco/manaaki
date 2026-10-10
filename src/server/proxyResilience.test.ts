import * as http from "node:http"
import type { AddressInfo } from "node:net"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { mealieFetch } from "./mealieUpstream"
import { handleApiProxy } from "./proxy"
import { buildSessionSetCookie } from "./session"

type Held = { url: string; respond: () => void }

let server: http.Server
let held: Held[] = []
let seen: string[] = []
let closedEarly: string[] = []
let holdResponses = false

function startServer(): Promise<void> {
  return new Promise(resolve => {
    server = http.createServer((req, res) => {
      const url = req.url ?? ""
      seen.push(url)
      req.resume()
      res.on("close", () => {
        if (!res.writableEnded) closedEarly.push(url)
      })
      const respond = () => {
        if (res.headersSent || res.destroyed) return
        const status = req.method === "DELETE" ? 204 : 200
        res.writeHead(status, { "content-type": "application/json" })
        res.end(status === 204 ? undefined : "{}")
      }
      if (holdResponses) held.push({ url, respond })
      else respond()
    })
    server.listen(0, "127.0.0.1", () => {
      process.env.MEALIE_INTERNAL_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
      resolve()
    })
  })
}

function anonymousGet(path: string, init: RequestInit = {}): Request {
  return new Request(`https://manaaki.example${path}`, {
    ...init,
    headers: { "x-forwarded-proto": "https" },
  })
}

function signedIn(path: string, init: RequestInit = {}): Request {
  const iat = Math.floor(Date.now() / 1000) - 10
  const exp = iat + 3600
  const token = `h.${Buffer.from(JSON.stringify({ exp, iat })).toString("base64url")}.s`
  return new Request(`https://manaaki.example${path}`, {
    ...init,
    headers: {
      "x-forwarded-proto": "https",
      "content-type": "application/json",
      cookie: buildSessionSetCookie(token, true).split(";")[0],
    },
  })
}

async function until(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 200 && !condition(); attempt++) {
    await new Promise(resolve => setTimeout(resolve, 5))
  }
  expect(condition()).toBe(true)
}

beforeEach(async () => {
  held = []
  seen = []
  closedEarly = []
  holdResponses = false
  process.env.SESSION_SECRET = "unit-test-secret"
  process.env.MEALIE_READONLY_TOKEN = "ro-token"
  process.env.MEALIE_READ_TIMEOUT_MS = "60"
  process.env.MEALIE_WRITE_TIMEOUT_MS = "400"
  process.env.MEALIE_STALLED_SLOT_HOLD_MS = "1"
  await startServer()
})

afterEach(async () => {
  delete process.env.MEALIE_READ_TIMEOUT_MS
  delete process.env.MEALIE_WRITE_TIMEOUT_MS
  delete process.env.MEALIE_STALLED_SLOT_HOLD_MS
  delete process.env.MEALIE_CONCURRENCY_LIMIT
  delete process.env.MEALIE_QUEUE_TIMEOUT_MS
  for (const request of held.splice(0)) request.respond()
  await new Promise(resolve => setTimeout(resolve, 10))
  server.closeAllConnections()
  await new Promise<void>(resolve => server.close(() => resolve()))
})

describe("handleApiProxy when Mealie stops answering", () => {
  it("gives up on a read after the read timeout and answers 504 without caching", async () => {
    holdResponses = true

    const res = await handleApiProxy(anonymousGet("/api/recipes"))

    expect(res.status).toBe(504)
    expect(res.headers.get("cache-control")).toBe("no-store")
    await until(() => closedEarly.includes("/api/recipes"))
  })

  it("lets a write run past the read timeout, up to the write timeout", async () => {
    holdResponses = true
    const pending = handleApiProxy(
      signedIn("/api/recipes/create/url", { method: "POST", body: "{}" })
    )
    await until(() => held.some(request => request.url === "/api/recipes/create/url"))
    await new Promise(resolve => setTimeout(resolve, 120))
    held.find(request => request.url === "/api/recipes/create/url")?.respond()

    expect((await pending).status).toBe(200)
  })

  it("gives up on a write after the write timeout", async () => {
    holdResponses = true

    const res = await handleApiProxy(
      signedIn("/api/recipes/create/url", { method: "POST", body: "{}" })
    )

    expect(res.status).toBe(504)
  })

  it("times only the wait for the response to start, not a slow body", async () => {
    server.removeAllListeners("request")
    server.on("request", (_req, res) => {
      res.writeHead(200, { "content-type": "text/plain" })
      res.write("first")
      setTimeout(() => res.end(" second"), 150)
    })

    const res = await handleApiProxy(anonymousGet("/api/recipes"))

    expect(res.status).toBe(200)
    expect(await res.text()).toBe("first second")
  })

  it("answers 504 without forwarding when the session refresh times out", async () => {
    holdResponses = true
    const exp = Math.floor(Date.now() / 1000) + 600
    const token = `h.${Buffer.from(JSON.stringify({ exp, iat: exp - 7200 })).toString("base64url")}.s`
    const request = new Request("https://manaaki.example/api/households/mealplans", {
      headers: {
        "x-forwarded-proto": "https",
        cookie: buildSessionSetCookie(token, true).split(";")[0],
      },
    })

    const res = await handleApiProxy(request)

    expect(res.status).toBe(504)
    expect(seen).toEqual(["/api/auth/refresh"])
  })
})

describe("handleApiProxy when Mealie cannot be reached", () => {
  it("answers 502 without caching", async () => {
    await new Promise<void>(resolve => server.close(() => resolve()))
    const closedPort = process.env.MEALIE_INTERNAL_URL

    const res = await handleApiProxy(anonymousGet("/api/recipes"))

    expect(res.status).toBe(502)
    expect(res.headers.get("cache-control")).toBe("no-store")
    await startServer()
    expect(process.env.MEALIE_INTERNAL_URL).not.toBe(closedPort)
  })
})

describe("handleApiProxy when the browser goes away", () => {
  it("drops the upstream request so Mealie stops working on it", async () => {
    holdResponses = true
    const browser = new AbortController()
    const pending = handleApiProxy(anonymousGet("/api/recipes", { signal: browser.signal }))
    await until(() => held.length === 1)

    browser.abort()

    expect((await pending).status).toBe(499)
    await until(() => closedEarly.includes("/api/recipes"))
  })
})

describe("handleApiProxy responses without a body", () => {
  it("drains each 204 so its upstream connection can be reused", async () => {
    let connections = 0
    server.on("connection", () => connections++)

    for (let request = 0; request < 3; request++) {
      const res = await handleApiProxy(
        signedIn("/api/households/mealplans/1", { method: "DELETE" })
      )
      expect(res.status).toBe(204)
      await new Promise(resolve => setTimeout(resolve, 20))
    }

    expect(connections).toBe(1)
  })
})

describe("handleApiProxy concurrency towards Mealie", () => {
  beforeEach(() => {
    process.env.MEALIE_CONCURRENCY_LIMIT = "2"
    process.env.MEALIE_READ_TIMEOUT_MS = "2000"
    process.env.MEALIE_QUEUE_TIMEOUT_MS = "2000"
  })

  it("never has more than the limit in flight, and serves the rest as slots free up", async () => {
    holdResponses = true
    const responses = Array.from({ length: 5 }, (_, index) =>
      handleApiProxy(anonymousGet(`/api/recipes/recipe-${index}`))
    )
    await until(() => held.length === 2)
    await new Promise(resolve => setTimeout(resolve, 40))
    expect(seen).toHaveLength(2)

    let peak = held.length
    while (seen.length < 5 || held.length > 0) {
      peak = Math.max(peak, held.length)
      held.shift()?.respond()
      await new Promise(resolve => setTimeout(resolve, 5))
    }

    expect((await Promise.all(responses)).map(response => response.status)).toEqual([
      200, 200, 200, 200, 200,
    ])
    expect(peak).toBe(2)
    expect(seen).toEqual([0, 1, 2, 3, 4].map(index => `/api/recipes/recipe-${index}`))
  })

  it("lets images through while every slot is taken, since they need no database", async () => {
    holdResponses = true
    const blocked = [0, 1].map(index => handleApiProxy(anonymousGet(`/api/recipes/r${index}`)))
    await until(() => held.length === 2)
    const image = "/api/media/recipes/78789bca-e281-4dcd-a4a1-bb504aebe39f/images/original.webp"

    const pending = handleApiProxy(anonymousGet(image))
    await until(() => held.some(request => request.url === image))
    held.find(request => request.url === image)?.respond()

    expect((await pending).status).toBe(200)
    for (const request of held.splice(0)) request.respond()
    await Promise.all(blocked)
  })

  it("answers 503 with Retry-After when no slot frees up within the queue timeout", async () => {
    process.env.MEALIE_QUEUE_TIMEOUT_MS = "50"
    holdResponses = true
    const blocked = [0, 1].map(index => handleApiProxy(anonymousGet(`/api/recipes/r${index}`)))
    await until(() => held.length === 2)

    const res = await handleApiProxy(anonymousGet("/api/recipes/late"))

    expect(res.status).toBe(503)
    expect(res.headers.get("retry-after")).toBe("2")
    expect(res.headers.get("cache-control")).toBe("no-store")
    expect(seen).not.toContain("/api/recipes/late")
    for (const request of held.splice(0)) request.respond()
    await Promise.all(blocked)
  })

  it("counts server-side Mealie calls against the same limit as proxied ones", async () => {
    process.env.MEALIE_QUEUE_TIMEOUT_MS = "50"
    holdResponses = true
    const blocked = [0, 1].map(index => handleApiProxy(anonymousGet(`/api/recipes/r${index}`)))
    await until(() => held.length === 2)

    await expect(
      mealieFetch(`${process.env.MEALIE_INTERNAL_URL}/api/users/self`)
    ).rejects.toMatchObject({ name: "MealieBusyError" })

    expect(seen).not.toContain("/api/users/self")
    for (const request of held.splice(0)) request.respond()
    await Promise.all(blocked)
  })

  it("frees the slot when a server-side call fails or is answered", async () => {
    process.env.MEALIE_CONCURRENCY_LIMIT = "1"
    process.env.MEALIE_QUEUE_TIMEOUT_MS = "50"
    const url = `${process.env.MEALIE_INTERNAL_URL}/api/users/self`

    expect((await mealieFetch(url)).status).toBe(200)
    await expect(mealieFetch("http://127.0.0.1:1/api/users/self")).rejects.toBeInstanceOf(TypeError)

    expect((await mealieFetch(url)).status).toBe(200)
  })

  it("frees the slot when a proxied request fails before it is sent", async () => {
    process.env.MEALIE_CONCURRENCY_LIMIT = "1"
    process.env.MEALIE_QUEUE_TIMEOUT_MS = "50"
    const internalUrl = process.env.MEALIE_INTERNAL_URL
    delete process.env.MEALIE_INTERNAL_URL
    await expect(handleApiProxy(anonymousGet("/api/recipes/unsent"))).rejects.toThrow(
      "MEALIE_INTERNAL_URL"
    )
    process.env.MEALIE_INTERNAL_URL = internalUrl

    expect((await handleApiProxy(anonymousGet("/api/recipes/next"))).status).toBe(200)
  })

  it("drops a queued request whose browser goes away before it reaches Mealie", async () => {
    holdResponses = true
    const blocked = [0, 1].map(index => handleApiProxy(anonymousGet(`/api/recipes/r${index}`)))
    await until(() => held.length === 2)
    const browser = new AbortController()
    const queued = handleApiProxy(anonymousGet("/api/recipes/queued", { signal: browser.signal }))

    browser.abort()

    expect((await queued).status).toBe(499)
    for (const request of held.splice(0)) request.respond()
    await Promise.all(blocked)
    expect(seen).not.toContain("/api/recipes/queued")
  })

  it("keeps a timed-out request's slot occupied while Mealie may still be working on it", async () => {
    process.env.MEALIE_CONCURRENCY_LIMIT = "1"
    process.env.MEALIE_READ_TIMEOUT_MS = "40"
    process.env.MEALIE_QUEUE_TIMEOUT_MS = "40"
    process.env.MEALIE_STALLED_SLOT_HOLD_MS = "250"
    holdResponses = true
    expect((await handleApiProxy(anonymousGet("/api/recipes/stuck"))).status).toBe(504)
    holdResponses = false

    const duringHold = await handleApiProxy(anonymousGet("/api/recipes/during-hold"))
    await new Promise(resolve => setTimeout(resolve, 260))
    const afterHold = await handleApiProxy(anonymousGet("/api/recipes/after-hold"))

    expect(duringHold.status).toBe(503)
    expect(seen).not.toContain("/api/recipes/during-hold")
    expect(afterHold.status).toBe(200)
  })

  it("holds the slot after a server-side call times out too", async () => {
    process.env.MEALIE_CONCURRENCY_LIMIT = "1"
    process.env.MEALIE_READ_TIMEOUT_MS = "40"
    process.env.MEALIE_QUEUE_TIMEOUT_MS = "40"
    process.env.MEALIE_STALLED_SLOT_HOLD_MS = "250"
    holdResponses = true
    const url = `${process.env.MEALIE_INTERNAL_URL}/api/users/self`
    await expect(mealieFetch(url)).rejects.toMatchObject({ name: "MealieTimeoutError" })
    holdResponses = false

    await expect(mealieFetch(url)).rejects.toMatchObject({ name: "MealieBusyError" })
    await new Promise(resolve => setTimeout(resolve, 260))

    expect((await mealieFetch(url)).status).toBe(200)
  })
})
