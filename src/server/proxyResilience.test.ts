import * as http from "node:http"
import type { AddressInfo } from "node:net"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

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
  await startServer()
})

afterEach(async () => {
  delete process.env.MEALIE_READ_TIMEOUT_MS
  delete process.env.MEALIE_WRITE_TIMEOUT_MS
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
