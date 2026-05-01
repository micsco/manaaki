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

  it("retries on a 500 response and succeeds on the second attempt", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(err(500)).mockResolvedValueOnce(ok())
    vi.stubGlobal("fetch", mockFetch)

    const response = await runWithTimers(retryingFetch("/api/test"))

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect((response as Response).status).toBe(200)
  })

  it("retries on a 429 response and succeeds on the second attempt", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(err(429)).mockResolvedValueOnce(ok())
    vi.stubGlobal("fetch", mockFetch)

    const response = await runWithTimers(retryingFetch("/api/test"))

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect((response as Response).status).toBe(200)
  })

  it("exhausts all attempts and returns the final error response", async () => {
    const mockFetch = vi.fn().mockResolvedValue(err(503))
    vi.stubGlobal("fetch", mockFetch)

    const response = await runWithTimers(retryingFetch("/api/test"))

    expect(mockFetch).toHaveBeenCalledTimes(3)
    expect((response as Response).status).toBe(503)
  })

  it("exhausts all attempts and throws after repeated network errors", async () => {
    vi.useRealTimers()
    const networkError = new TypeError("Failed to fetch")
    const mockFetch = vi.fn().mockImplementation(() => Promise.reject(networkError))
    vi.stubGlobal("fetch", mockFetch)

    vi.spyOn(globalThis, "setTimeout").mockImplementation((fn: TimerHandler) => {
      if (typeof fn === "function") fn()
      return 0 as unknown as ReturnType<typeof setTimeout>
    })

    await expect(retryingFetch("/api/test")).rejects.toThrow("Failed to fetch")
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it("does not retry POST requests on network error", async () => {
    const mockFetch = vi
      .fn()
      .mockImplementation(() => Promise.reject(new TypeError("Failed to fetch")))
    vi.stubGlobal("fetch", mockFetch)

    await expect(retryingFetch("/api/test", { method: "POST" })).rejects.toThrow()
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

  it("applies a delay between retries", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(err(500)).mockResolvedValueOnce(ok())
    vi.stubGlobal("fetch", mockFetch)
    const setSpy = vi.spyOn(globalThis, "setTimeout")

    await runWithTimers(retryingFetch("/api/test"))

    expect(setSpy).toHaveBeenCalledTimes(1)
    const delay = setSpy.mock.calls[0][1] as number
    expect(delay).toBeGreaterThanOrEqual(500)
    expect(delay).toBeLessThan(2000)
  })

  it("treats 4xx (except 429) as a final response without retrying", async () => {
    const mockFetch = vi.fn().mockResolvedValue(err(404))
    vi.stubGlobal("fetch", mockFetch)

    const response = await retryingFetch("/api/test")

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(404)
  })
})
