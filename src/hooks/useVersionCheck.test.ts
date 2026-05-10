import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { toastManager } from "../lib/toastManager"
import { useVersionCheck } from "./useVersionCheck"

const POLL_INTERVAL_MS = 5 * 60 * 1000
const IDLE_PROMPT_MS = 15 * 60 * 1000

function makeMockRouter() {
  const listeners = new Map<string, Set<() => void>>()

  return {
    subscribe: vi.fn((eventType: string, fn: () => void) => {
      if (!listeners.has(eventType)) listeners.set(eventType, new Set())
      listeners.get(eventType)?.add(fn)
      return () => listeners.get(eventType)?.delete(fn)
    }),
    triggerEvent: (eventType: string) => {
      for (const fn of listeners.get(eventType) ?? []) fn()
    },
  }
}

function mockFetch(sha: string) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ sha }),
  })
}

async function advanceTimersAndFlush(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms)
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe("useVersionCheck", () => {
  const reloadMock = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubEnv("VITE_BUILD_GIT_SHORT_SHA", "abc1234")
    Object.defineProperty(window, "location", {
      value: { ...window.location, reload: reloadMock },
      writable: true,
    })
    reloadMock.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("does not poll or subscribe when no SHA is set (dev mode)", () => {
    vi.stubEnv("VITE_BUILD_GIT_SHORT_SHA", "")
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const router = makeMockRouter()

    renderHook(() => useVersionCheck(router as any))

    expect(router.subscribe).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("subscribes to onResolved and sets up a poll interval", () => {
    const router = makeMockRouter()
    global.fetch = mockFetch("abc1234")

    renderHook(() => useVersionCheck(router as any))

    expect(router.subscribe).toHaveBeenCalledWith("onResolved", expect.any(Function))
  })

  it("does not reload on navigation when no update is detected", async () => {
    const router = makeMockRouter()
    global.fetch = mockFetch("abc1234")

    renderHook(() => useVersionCheck(router as any))

    await advanceTimersAndFlush(POLL_INTERVAL_MS)

    act(() => router.triggerEvent("onResolved"))

    expect(reloadMock).not.toHaveBeenCalled()
  })

  it("reloads on navigation when a new version is detected", async () => {
    const router = makeMockRouter()
    global.fetch = mockFetch("newsha99")

    renderHook(() => useVersionCheck(router as any))

    await advanceTimersAndFlush(POLL_INTERVAL_MS)

    act(() => router.triggerEvent("onResolved"))

    expect(reloadMock).toHaveBeenCalledTimes(1)
  }, 10000)

  it("shows a toast after 15 minutes of idle when update is available", async () => {
    const router = makeMockRouter()
    global.fetch = mockFetch("newsha99")
    const addSpy = vi.spyOn(toastManager, "add")

    renderHook(() => useVersionCheck(router as any))

    await advanceTimersAndFlush(IDLE_PROMPT_MS + POLL_INTERVAL_MS)

    expect(addSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "app-update-available",
        title: "Update available",
        timeout: 0,
      })
    )
  }, 10000)

  it("does not show the toast more than once", async () => {
    const router = makeMockRouter()
    global.fetch = mockFetch("newsha99")
    const addSpy = vi.spyOn(toastManager, "add")

    renderHook(() => useVersionCheck(router as any))

    await advanceTimersAndFlush(IDLE_PROMPT_MS + POLL_INTERVAL_MS * 3)

    expect(addSpy).toHaveBeenCalledTimes(1)
  }, 10000)

  it("does not show the toast when the user has been active recently", async () => {
    const router = makeMockRouter()
    global.fetch = mockFetch("newsha99")
    const addSpy = vi.spyOn(toastManager, "add")

    renderHook(() => useVersionCheck(router as any))

    await advanceTimersAndFlush(POLL_INTERVAL_MS)

    vi.setSystemTime(Date.now() + IDLE_PROMPT_MS - 1000)
    window.dispatchEvent(new Event("pointermove"))

    await advanceTimersAndFlush(POLL_INTERVAL_MS)

    expect(addSpy).not.toHaveBeenCalled()
  }, 10000)

  it("cleans up interval and subscription on unmount", async () => {
    const router = makeMockRouter()
    global.fetch = mockFetch("newsha99")

    const { unmount } = renderHook(() => useVersionCheck(router as any))
    unmount()

    await advanceTimersAndFlush(POLL_INTERVAL_MS)

    act(() => router.triggerEvent("onResolved"))

    expect(reloadMock).not.toHaveBeenCalled()
  })
})
