import { afterEach, expect, it, vi } from "vitest"

import { pendingWriteCount, resetUpdateHoldsForTesting } from "../pwa/updateHolds"
import { clientFetch } from "./clientFetch"

afterEach(() => {
  resetUpdateHoldsForTesting()
  vi.restoreAllMocks()
})

it("holds app updates while a write is in flight", async () => {
  let respond!: (response: Response) => void
  vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(resolve => (respond = resolve)))
  const write = clientFetch("/api/households/shopping/items", { method: "POST" })
  expect(pendingWriteCount()).toBe(1)
  respond(new Response("{}"))
  await write
  expect(pendingWriteCount()).toBe(0)
})

it("does not hold app updates for reads", async () => {
  let respond!: (response: Response) => void
  vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(resolve => (respond = resolve)))
  const read = clientFetch(new Request("http://localhost/api/recipes"))
  expect(pendingWriteCount()).toBe(0)
  respond(new Response("{}"))
  await read
})

it("tells the server which build is calling", async () => {
  vi.stubEnv("VITE_BUILD_GIT_SHORT_SHA", "abc1234")
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"))
  await clientFetch(new Request("http://localhost/api/recipes"))
  const [, init] = fetchSpy.mock.calls[0]
  expect(new Headers(init?.headers).get("x-manaaki-build")).toBe("abc1234")
  vi.unstubAllEnvs()
})
