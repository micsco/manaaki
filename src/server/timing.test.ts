import { describe, expect, it, vi } from "vitest"

import { measureServerTiming, withServerTiming } from "./timing"

describe("server timing", () => {
  it("aggregates named work and preserves streaming responses and headers", async () => {
    let now = 0
    const clock = vi.spyOn(performance, "now").mockImplementation(() => now)
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("body"))
        controller.close()
      },
    })
    try {
      const result = await withServerTiming(async () => {
        await measureServerTiming("mealie", () => {
          now += 30
        })
        await measureServerTiming("mealie", () => {
          now += 20
        })
        return {
          response: new Response(stream, {
            status: 201,
            headers: {
              "Set-Cookie": "session=private; HttpOnly",
              "Cache-Control": "private, no-store",
              "Server-Timing": "upstream;dur=2",
            },
          }),
        }
      }, "ssr")
      expect(result.response.headers.get("Server-Timing")).toBe(
        "upstream;dur=2, mealie;dur=50.0, ssr;dur=50.0"
      )
      expect(result.response.headers.get("Set-Cookie")).toBe("session=private; HttpOnly")
      expect(result.response.headers.get("Cache-Control")).toBe("private, no-store")
      expect(result.response.status).toBe(201)
      expect(result.response.body).toBe(stream)
      expect(result.response.bodyUsed).toBe(false)
      expect(await result.response.text()).toBe("body")
    } finally {
      clock.mockRestore()
    }
  })

  it("isolates overlapping requests and does not retain their timings", async () => {
    let finish!: () => void
    const pending = new Promise<void>(resolve => {
      finish = resolve
    })
    const first = withServerTiming(async () => {
      await measureServerTiming("identity", () => pending)
      return { response: new Response() }
    })
    const second = await withServerTiming(async () => {
      await measureServerTiming("session_refresh", () => undefined)
      return { response: new Response() }
    })
    finish()
    const firstResult = await first
    expect(firstResult.response.headers.get("Server-Timing")).toContain("identity;dur=")
    expect(firstResult.response.headers.get("Server-Timing")).not.toContain("session_refresh")
    expect(second.response.headers.get("Server-Timing")).toContain("session_refresh;dur=")
    expect(second.response.headers.get("Server-Timing")).not.toContain("identity")
    await measureServerTiming("mealie", () => undefined)
    const third = await withServerTiming(() => ({ response: new Response() }))
    expect(third.response.headers.get("Server-Timing")).toMatch(/^app;dur=[\d.]+$/)
  })

  it("records failed work without exposing the failure or swallowing it", async () => {
    const failure = new Error("private upstream URL and token")
    const result = await withServerTiming(async () => {
      await expect(
        measureServerTiming("mealie", () => {
          throw failure
        })
      ).rejects.toBe(failure)
      return { response: new Response(null, { status: 503 }) }
    })
    expect(result.response.status).toBe(503)
    expect(result.response.headers.get("Server-Timing")).toMatch(
      /^mealie;dur=[\d.]+, app;dur=[\d.]+$/
    )
  })
})
