import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { installTestPostHog } from "../test/serverPostHog"
import { MealieBusyError } from "./mealieLimiter"
import {
  mealieFetch,
  MealieTimeoutError,
  mealieTimeoutMs,
  MealieUnreachableError,
  upstreamFailureResponse,
} from "./mealieUpstream"

function hangingFetch() {
  return vi.spyOn(globalThis, "fetch").mockImplementation(
    (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal
        if (signal?.aborted) reject(signal.reason)
        signal?.addEventListener("abort", () => reject(signal.reason), { once: true })
      })
  )
}

beforeEach(() => {
  process.env.MEALIE_READ_TIMEOUT_MS = "30"
  process.env.MEALIE_WRITE_TIMEOUT_MS = "200"
  process.env.MEALIE_STALLED_SLOT_HOLD_MS = "1"
})

afterEach(() => {
  delete process.env.MEALIE_READ_TIMEOUT_MS
  delete process.env.MEALIE_WRITE_TIMEOUT_MS
  delete process.env.MEALIE_STALLED_SLOT_HOLD_MS
  vi.restoreAllMocks()
})

describe("mealieTimeoutMs", () => {
  it("gives reads a short deadline and writes a long one", () => {
    expect(mealieTimeoutMs("get")).toBe(30)
    expect(mealieTimeoutMs("HEAD")).toBe(30)
    expect(mealieTimeoutMs("POST")).toBe(200)
    expect(mealieTimeoutMs("DELETE")).toBe(200)
  })

  it("falls back to the defaults when the overrides are missing or invalid", () => {
    delete process.env.MEALIE_READ_TIMEOUT_MS
    process.env.MEALIE_WRITE_TIMEOUT_MS = "soon"

    expect(mealieTimeoutMs("GET")).toBe(15_000)
    expect(mealieTimeoutMs("POST")).toBe(120_000)
  })
})

describe("mealieFetch", () => {
  it("passes the request through and returns Mealie's response", async () => {
    const upstream = new Response("{}", { status: 200 })
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(upstream)

    const response = await mealieFetch("http://mealie:9000/api/recipes", {
      headers: { Authorization: "Bearer token" },
    })

    expect(response).toBe(upstream)
    const [input, init] = fetchMock.mock.calls[0]
    expect(input).toBe("http://mealie:9000/api/recipes")
    expect(init?.headers).toEqual({ Authorization: "Bearer token" })
    expect(init?.signal).toBeInstanceOf(AbortSignal)
  })

  it("fails with a timeout error when Mealie does not answer a read in time", async () => {
    hangingFetch()

    await expect(mealieFetch("http://mealie:9000/api/recipes")).rejects.toBeInstanceOf(
      MealieTimeoutError
    )
  })

  it("uses the write deadline for a write sent as a Request", async () => {
    hangingFetch()
    const started = Date.now()

    await expect(
      mealieFetch(new Request("http://mealie:9000/api/auth/refresh", { method: "POST" }))
    ).rejects.toBeInstanceOf(MealieTimeoutError)
    expect(Date.now() - started).toBeGreaterThanOrEqual(150)
  })

  it("stops when the caller aborts, without calling it a timeout", async () => {
    hangingFetch()
    const caller = new AbortController()
    const pending = mealieFetch("http://mealie:9000/api/recipes", { signal: caller.signal })

    caller.abort()

    await expect(pending).rejects.toMatchObject({ name: "AbortError" })
  })

  it("honours the abort signal carried by a Request", async () => {
    hangingFetch()
    const caller = new AbortController()
    const pending = mealieFetch(
      new Request("http://mealie:9000/api/recipes", { signal: caller.signal })
    )

    caller.abort()

    await expect(pending).rejects.toMatchObject({ name: "AbortError" })
  })

  it("leaves other fetch failures untouched so the caller can retry them", async () => {
    const refused = new TypeError("fetch failed")
    vi.spyOn(globalThis, "fetch").mockRejectedValue(refused)

    await expect(mealieFetch("http://mealie:9000/api/recipes")).rejects.toBe(refused)
  })
})

describe("upstreamFailureResponse", () => {
  it("maps a full queue to an uncacheable 503 that says when to come back", () => {
    const response = upstreamFailureResponse(new MealieBusyError("busy"))

    expect(response?.status).toBe(503)
    expect(response?.headers.get("retry-after")).toBe("2")
    expect(response?.headers.get("cache-control")).toBe("no-store")
  })

  it("maps a timeout to an uncacheable 504", () => {
    const response = upstreamFailureResponse(new MealieTimeoutError("slow"))

    expect(response?.status).toBe(504)
    expect(response?.headers.get("cache-control")).toBe("no-store")
  })

  it("maps an unreachable Mealie to an uncacheable 502", () => {
    const response = upstreamFailureResponse(new MealieUnreachableError("down"))

    expect(response?.status).toBe(502)
    expect(response?.headers.get("cache-control")).toBe("no-store")
  })

  it("leaves unrelated errors alone", () => {
    expect(upstreamFailureResponse(new Error("bug"))).toBeNull()
  })

  it("counts each kind of Mealie failure", async () => {
    const posthog = installTestPostHog()
    try {
      upstreamFailureResponse(new MealieBusyError("busy"))
      upstreamFailureResponse(new MealieBusyError("busy"))
      upstreamFailureResponse(new MealieTimeoutError("slow"))
      upstreamFailureResponse(new Error("bug"))
      const failuresByReason: Record<string, number> = {}
      for (const sample of await posthog.flushMetrics()) {
        if (sample.name !== "mealie.upstream.failures") continue
        const reason = String(sample.attributes?.reason)
        failuresByReason[reason] = (failuresByReason[reason] ?? 0) + sample.value
      }
      expect(failuresByReason).toEqual({ busy: 2, timeout: 1 })
    } finally {
      await posthog.uninstall()
    }
  })
})
