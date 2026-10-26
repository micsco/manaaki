import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  applyAppUpdate,
  isApplyingAppUpdate,
  LOOP_GUARD_MS,
  markUpdatePending,
  onUpdatePending,
  recentlyAttemptedUpdate,
  resetAppUpdateForTesting,
  takeAppliedUpdate,
  updatePendingSince,
} from "./appUpdate"

const reload = vi.fn()
const assign = vi.fn()
const replace = vi.fn()

beforeEach(() => {
  vi.stubEnv("VITE_BUILD_GIT_SHORT_SHA", "old1234")
  vi.stubGlobal("location", { href: window.location.href, reload, assign, replace })
})

afterEach(() => {
  resetAppUpdateForTesting()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.clearAllMocks()
})

function stubWorker(waiting: { postMessage: (message: unknown) => void } | null) {
  const listeners: (() => void)[] = []
  vi.stubGlobal("navigator", {
    serviceWorker: {
      getRegistration: async () => ({ waiting }),
      addEventListener: (_type: string, listener: () => void) => listeners.push(listener),
    },
  })
  return () => listeners.forEach(listener => listener())
}

describe("pending updates", () => {
  it("remembers when an update first became available and tells listeners", () => {
    vi.useFakeTimers({ now: 1000 })
    const listener = vi.fn()
    const stop = onUpdatePending(listener)
    markUpdatePending("worker-waiting")
    vi.setSystemTime(5000)
    markUpdatePending("version-file")
    expect(updatePendingSince()).toBe(1000)
    expect(listener).toHaveBeenCalledTimes(2)
    stop()
  })
})

describe("applyAppUpdate", () => {
  it("switches to the waiting worker before loading the destination", async () => {
    const postMessage = vi.fn()
    const activate = stubWorker({ postMessage })
    postMessage.mockImplementation(() => activate())
    await applyAppUpdate("navigation", { href: "/plan" })
    expect(postMessage).toHaveBeenCalledWith({ type: "ACTIVATE_UPDATE" })
    expect(assign).toHaveBeenCalledWith("/plan")
    expect(reload).not.toHaveBeenCalled()
    expect(isApplyingAppUpdate()).toBe(true)
  })

  it("replaces the history entry when the navigation was a replace", async () => {
    stubWorker(null)
    await applyAppUpdate("navigation", { href: "/recipes?q=soup", replace: true })
    expect(replace).toHaveBeenCalledWith("/recipes?q=soup")
  })

  it("reloads in place without a destination, even without a waiting worker", async () => {
    stubWorker(null)
    await applyAppUpdate("idle")
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it("still reloads if the worker never takes over", async () => {
    vi.useFakeTimers()
    stubWorker({ postMessage: vi.fn() })
    const applying = applyAppUpdate("idle")
    await vi.advanceTimersByTimeAsync(3000)
    await applying
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it("only starts once", async () => {
    stubWorker(null)
    await Promise.all([applyAppUpdate("idle"), applyAppUpdate("resume")])
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it("stops pending updates being marked while it is applying", async () => {
    stubWorker(null)
    await applyAppUpdate("idle")
    const listener = vi.fn()
    const stop = onUpdatePending(listener)
    markUpdatePending("worker-activated")
    expect(listener).not.toHaveBeenCalled()
    stop()
  })

  it("guards against reload loops on the same build", async () => {
    vi.useFakeTimers({ now: 10_000 })
    stubWorker(null)
    expect(recentlyAttemptedUpdate()).toBe(false)
    await applyAppUpdate("idle")
    expect(recentlyAttemptedUpdate()).toBe(true)
    vi.setSystemTime(10_000 + LOOP_GUARD_MS)
    expect(recentlyAttemptedUpdate()).toBe(false)
  })

  it("reports the applied update once after the new build loads", async () => {
    vi.useFakeTimers({ now: 1000 })
    stubWorker(null)
    markUpdatePending("worker-waiting")
    vi.setSystemTime(4000)
    await applyAppUpdate("resume")
    vi.stubEnv("VITE_BUILD_GIT_SHORT_SHA", "new5678")
    expect(takeAppliedUpdate()).toEqual({
      trigger: "resume",
      source: "worker-waiting",
      heldMs: 3000,
      fromSha: "old1234",
      toSha: "new5678",
      activation: "none-waiting",
      updated: true,
    })
    expect(takeAppliedUpdate()).toBeNull()
  })

  it("reports a reload that stayed on the same build as not updated", async () => {
    stubWorker(null)
    await applyAppUpdate("idle")
    expect(takeAppliedUpdate()).toMatchObject({
      trigger: "idle",
      fromSha: "old1234",
      toSha: "old1234",
      updated: false,
    })
  })

  it("records whether the waiting worker took over in time", async () => {
    vi.useFakeTimers()
    stubWorker({ postMessage: vi.fn() })
    const applying = applyAppUpdate("idle")
    await vi.advanceTimersByTimeAsync(3000)
    await applying
    expect(takeAppliedUpdate()?.activation).toBe("timeout")

    resetAppUpdateForTesting()
    const activate = stubWorker({ postMessage: vi.fn() })
    const activating = applyAppUpdate("idle")
    await vi.advanceTimersByTimeAsync(0)
    activate()
    await activating
    expect(takeAppliedUpdate()?.activation).toBe("activated")

    resetAppUpdateForTesting()
    vi.stubGlobal("navigator", {})
    await applyAppUpdate("idle")
    expect(takeAppliedUpdate()?.activation).toBe("unsupported")
  })
})
