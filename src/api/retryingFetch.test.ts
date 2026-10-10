import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { retryingFetch } from "./retryingFetch"

const ok = (status = 200) => new Response(null, { status })
const err = (status: number) => new Response(null, { status })

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

async function runWithTimers(promise: Promise<unknown>) {
  const result = promise
  await vi.runAllTimersAsync()
  return result
}

describe("retryingFetch", () => {
  it("returns a successful response immediately without retrying", async () => {
    const mockFetch = vi.fn().mockResolvedValue(ok())
    vi.stubGlobal("fetch", mockFetch)

    const response = await retryingFetch("/api/test")

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(200)
  })

  it("retries on a network error and succeeds on the second attempt", async () => {
    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(ok())
    vi.stubGlobal("fetch", mockFetch)

    const response = await runWithTimers(retryingFetch("/api/test"))

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect((response as Response).status).toBe(200)
  })

  it.each([500, 502, 503, 504, 429])(
    "returns a %i response as final so a struggling server is not asked again",
    async status => {
      const mockFetch = vi.fn().mockResolvedValue(err(status))
      vi.stubGlobal("fetch", mockFetch)

      const response = await runWithTimers(retryingFetch("/api/test"))

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect((response as Response).status).toBe(status)
    }
  )

  it("gives up after one retry when the network keeps failing", async () => {
    const mockFetch = vi
      .fn()
      .mockImplementation(() => Promise.reject(new TypeError("Failed to fetch")))
    vi.stubGlobal("fetch", mockFetch)

    const outcome = retryingFetch("/api/test").catch((error: unknown) => error)
    await vi.runAllTimersAsync()

    expect(await outcome).toBeInstanceOf(TypeError)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it.each(["AbortError", "TimeoutError"])(
    "does not retry a request that ended in %s",
    async name => {
      const mockFetch = vi
        .fn()
        .mockImplementation(() => Promise.reject(new DOMException("stopped", name)))
      vi.stubGlobal("fetch", mockFetch)

      await expect(retryingFetch("/api/test")).rejects.toMatchObject({ name })
      expect(mockFetch).toHaveBeenCalledTimes(1)
    }
  )

  it("does not retry failures that are not network errors", async () => {
    const mockFetch = vi.fn().mockImplementation(() => Promise.reject(new Error("upstream busy")))
    vi.stubGlobal("fetch", mockFetch)

    await expect(retryingFetch("/api/test")).rejects.toThrow("upstream busy")
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("sends every attempt through the fetch implementation it is given", async () => {
    const globalFetch = vi.fn()
    vi.stubGlobal("fetch", globalFetch)
    const customFetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(ok())

    const response = await runWithTimers(retryingFetch("/api/test", undefined, customFetch))

    expect(customFetch).toHaveBeenCalledTimes(2)
    expect(customFetch).toHaveBeenCalledWith("/api/test", undefined)
    expect(globalFetch).not.toHaveBeenCalled()
    expect((response as Response).status).toBe(200)
  })

  it("does not retry POST requests on network error", async () => {
    const mockFetch = vi
      .fn()
      .mockImplementation(() => Promise.reject(new TypeError("Failed to fetch")))
    vi.stubGlobal("fetch", mockFetch)

    await expect(retryingFetch("/api/test", { method: "POST" })).rejects.toThrow()
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("reads the method from a Request so a write sent that way is never retried", async () => {
    const mockFetch = vi
      .fn()
      .mockImplementation(() => Promise.reject(new TypeError("Failed to fetch")))
    vi.stubGlobal("fetch", mockFetch)
    const request = new Request("https://app.example/api/test", { method: "POST", body: "{}" })

    await expect(retryingFetch(request)).rejects.toThrow("Failed to fetch")
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("does not retry POST requests on 500 response", async () => {
    const mockFetch = vi.fn().mockResolvedValue(err(500))
    vi.stubGlobal("fetch", mockFetch)

    const response = await retryingFetch("/api/test", { method: "POST" })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(500)
  })

  it("does not retry PUT requests on 503 response", async () => {
    const mockFetch = vi.fn().mockResolvedValue(err(503))
    vi.stubGlobal("fetch", mockFetch)

    const response = await retryingFetch("/api/test", { method: "PUT" })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(503)
  })

  it("applies a delay before the retry", async () => {
    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(ok())
    vi.stubGlobal("fetch", mockFetch)
    const setSpy = vi.spyOn(globalThis, "setTimeout")

    await runWithTimers(retryingFetch("/api/test"))

    expect(setSpy).toHaveBeenCalledTimes(1)
    const delay = setSpy.mock.calls[0][1] as number
    expect(delay).toBeGreaterThanOrEqual(500)
    expect(delay).toBeLessThan(2000)
  })

  it("treats 4xx as a final response without retrying", async () => {
    const mockFetch = vi.fn().mockResolvedValue(err(404))
    vi.stubGlobal("fetch", mockFetch)

    const response = await retryingFetch("/api/test")

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(404)
  })
})
