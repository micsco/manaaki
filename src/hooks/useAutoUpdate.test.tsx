import type { AnyRouter, BlockerFn } from "@tanstack/react-router"
import { act, render, renderHook, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AppToasts } from "../components/AppToasts"
import { toastManager } from "../lib/toastManager"
import {
  applyAppUpdate,
  markUpdatePending,
  resetAppUpdateForTesting,
  takeAppliedUpdate,
} from "../pwa/appUpdate"
import { holdAppUpdate, resetUpdateHoldsForTesting } from "../pwa/updateHolds"
import {
  FALLBACK_PROMPT_MS,
  FRESH_START_MS,
  HIDDEN_APPLY_MS,
  IDLE_APPLY_MS,
  IDLE_CHECK_MS,
  RESUME_APPLY_MS,
  useAutoUpdate,
  VERSION_POLL_MS,
} from "./useAutoUpdate"

vi.mock("../pwa/appUpdate", async original => ({
  ...(await original<typeof import("../pwa/appUpdate")>()),
  applyAppUpdate: vi.fn(),
  takeAppliedUpdate: vi.fn(() => null),
}))

let visibility: DocumentVisibilityState = "visible"
const analytics = { capture: vi.fn(), count: vi.fn(), gauge: vi.fn(), histogram: vi.fn() }

function makeRouter() {
  const blocker: { fn?: BlockerFn } = {}
  const resolved = new Set<() => void>()
  const router = {
    history: {
      block: vi.fn(({ blockerFn }: { blockerFn: BlockerFn }) => {
        blocker.fn = blockerFn
        return () => {}
      }),
    },
    subscribe: vi.fn((_event: string, listener: () => void) => {
      resolved.add(listener)
      return () => resolved.delete(listener)
    }),
  }
  const navigate = (from: string, to: string, action: "PUSH" | "REPLACE" | "BACK" = "PUSH") =>
    blocker.fn!({
      currentLocation: { pathname: from, href: from } as never,
      nextLocation: { pathname: to.split("?")[0], href: to } as never,
      action,
    })
  const finishNavigation = () => act(() => resolved.forEach(listener => listener()))
  return { router: router as unknown as AnyRouter, navigate, finishNavigation }
}

function start() {
  const routing = makeRouter()
  const view = renderHook(() => useAutoUpdate(routing.router, analytics))
  return { ...routing, view }
}

function setVisibility(state: DocumentVisibilityState) {
  visibility = state
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"))
  })
}

function tap() {
  act(() => {
    window.dispatchEvent(new Event("pointerdown"))
  })
}

beforeEach(() => {
  vi.useFakeTimers({ now: 1_000_000 })
  visibility = "visible"
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibility,
  })
  vi.stubEnv("VITE_BUILD_GIT_SHORT_SHA", "abc1234")
})

afterEach(() => {
  act(() => toastManager.close("app-update-available"))
  resetAppUpdateForTesting()
  resetUpdateHoldsForTesting()
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  for (const element of document.querySelectorAll("[data-test-dialog]")) element.remove()
})

describe("applying on launch", () => {
  it("applies straight away when the update is found before the user touches anything", () => {
    start()
    act(() => markUpdatePending("worker-waiting"))
    expect(applyAppUpdate).toHaveBeenCalledWith("launch")
  })

  it("waits once the user has started using the app", () => {
    start()
    tap()
    act(() => markUpdatePending("worker-waiting"))
    expect(applyAppUpdate).not.toHaveBeenCalled()
  })

  it("waits when the update arrives after the first few seconds", () => {
    start()
    vi.advanceTimersByTime(FRESH_START_MS)
    act(() => markUpdatePending("worker-waiting"))
    expect(applyAppUpdate).not.toHaveBeenCalled()
  })
})

describe("applying on the next navigation", () => {
  function pendingAfterUse() {
    const app = start()
    tap()
    act(() => markUpdatePending("worker-waiting"))
    return app
  }

  it("turns the next page change into a full load of that page", () => {
    const { navigate } = pendingAfterUse()
    expect(navigate("/recipes", "/plan?date=2026-10-26")).toBe(true)
    expect(applyAppUpdate).toHaveBeenCalledWith("navigation", {
      href: "/plan?date=2026-10-26",
      replace: false,
    })
  })

  it("keeps replace navigations as replaces", () => {
    const { navigate } = pendingAfterUse()
    navigate("/recipes", "/shopping", "REPLACE")
    expect(applyAppUpdate).toHaveBeenCalledWith("navigation", { href: "/shopping", replace: true })
  })

  it("leaves filter and search changes on the same page alone", () => {
    const { navigate } = pendingAfterUse()
    expect(navigate("/recipes", "/recipes?q=soup", "REPLACE")).toBe(false)
    expect(applyAppUpdate).not.toHaveBeenCalled()
  })

  it("lets navigation through untouched when there is no update", () => {
    const { navigate } = start()
    expect(navigate("/recipes", "/plan")).toBe(false)
    expect(applyAppUpdate).not.toHaveBeenCalled()
  })

  it("does not interrupt a save in progress", () => {
    const { navigate } = pendingAfterUse()
    holdAppUpdate("saving-plan")
    expect(navigate("/recipes", "/plan")).toBe(false)
    expect(applyAppUpdate).not.toHaveBeenCalled()
  })

  it("reloads after going back instead of fighting the browser history", () => {
    const { navigate, finishNavigation } = pendingAfterUse()
    expect(navigate("/plan", "/recipes", "BACK")).toBe(false)
    expect(applyAppUpdate).not.toHaveBeenCalled()
    finishNavigation()
    expect(applyAppUpdate).toHaveBeenCalledWith("navigation")
  })
})

describe("applying in the background or when idle", () => {
  function pendingAfterUse() {
    start()
    tap()
    act(() => markUpdatePending("worker-waiting"))
  }

  it("applies once the app has been in the background for a minute", () => {
    pendingAfterUse()
    setVisibility("hidden")
    vi.advanceTimersByTime(HIDDEN_APPLY_MS - 1)
    expect(applyAppUpdate).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(applyAppUpdate).toHaveBeenCalledWith("hidden")
  })

  it("does not apply if the user comes back within the minute", () => {
    pendingAfterUse()
    setVisibility("hidden")
    vi.advanceTimersByTime(HIDDEN_APPLY_MS / 2)
    setVisibility("visible")
    vi.advanceTimersByTime(HIDDEN_APPLY_MS)
    expect(applyAppUpdate).not.toHaveBeenCalled()
  })

  it("applies on return after a long time away when background timers were frozen", () => {
    pendingAfterUse()
    setVisibility("hidden")
    vi.setSystemTime(Date.now() + RESUME_APPLY_MS)
    setVisibility("visible")
    expect(applyAppUpdate).toHaveBeenCalledWith("resume")
  })

  it("applies an update found just after returning, before the user does anything", () => {
    start()
    tap()
    setVisibility("hidden")
    vi.setSystemTime(Date.now() + RESUME_APPLY_MS)
    setVisibility("visible")
    act(() => markUpdatePending("worker-waiting"))
    expect(applyAppUpdate).toHaveBeenCalledWith("resume")
  })

  it("does not reload over an open dialog on return", () => {
    pendingAfterUse()
    const dialog = document.createElement("div")
    dialog.setAttribute("role", "dialog")
    dialog.setAttribute("data-test-dialog", "")
    document.body.append(dialog)
    setVisibility("hidden")
    vi.setSystemTime(Date.now() + RESUME_APPLY_MS)
    setVisibility("visible")
    expect(applyAppUpdate).not.toHaveBeenCalled()
  })

  it("applies after ten quiet minutes on screen", () => {
    pendingAfterUse()
    vi.advanceTimersByTime(IDLE_APPLY_MS - IDLE_CHECK_MS)
    expect(applyAppUpdate).not.toHaveBeenCalled()
    vi.advanceTimersByTime(IDLE_CHECK_MS)
    expect(applyAppUpdate).toHaveBeenCalledWith("idle")
  })

  it("treats scrolling as activity", () => {
    pendingAfterUse()
    vi.advanceTimersByTime(IDLE_APPLY_MS - IDLE_CHECK_MS)
    act(() => {
      window.dispatchEvent(new Event("wheel"))
    })
    vi.advanceTimersByTime(IDLE_CHECK_MS)
    expect(applyAppUpdate).not.toHaveBeenCalled()
  })

  it("does not reload in place while cooking", () => {
    pendingAfterUse()
    holdAppUpdate("cooking", "in-place")
    vi.advanceTimersByTime(IDLE_APPLY_MS)
    expect(applyAppUpdate).not.toHaveBeenCalled()
  })
})

describe("fallback prompt", () => {
  it("asks only after the update has been held for twelve hours, and shows progress", async () => {
    vi.useRealTimers()
    vi.useFakeTimers({ now: 1_000_000, shouldAdvanceTime: true })
    render(<AppToasts />)
    start()
    tap()
    act(() => markUpdatePending("worker-waiting"))
    const release = holdAppUpdate("timer")
    act(() => {
      vi.advanceTimersByTime(FALLBACK_PROMPT_MS - IDLE_CHECK_MS)
    })
    expect(screen.queryByRole("button", { name: "Update" })).not.toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(IDLE_CHECK_MS)
    })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(await screen.findByRole("button", { name: "Update" }))
    expect(applyAppUpdate).toHaveBeenCalledWith("manual")
    expect(screen.getByRole("button", { name: "Updating…" })).toBeDisabled()
    release()
  })
})

describe("finding updates", () => {
  it("marks an update as pending from the version file when there is no service worker", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ sha: "new9999" }) })
    )
    start()
    tap()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(VERSION_POLL_MS)
    })
    vi.advanceTimersByTime(IDLE_APPLY_MS)
    expect(applyAppUpdate).toHaveBeenCalledWith("idle")
  })

  it("asks the service worker to fetch the new build instead of reloading around it", async () => {
    const update = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ sha: "new9999" }) })
    )
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { controller: {}, getRegistration: async () => ({ update }) },
    })
    start()
    tap()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(VERSION_POLL_MS)
    })
    expect(update).toHaveBeenCalled()
    vi.advanceTimersByTime(IDLE_APPLY_MS)
    expect(applyAppUpdate).not.toHaveBeenCalled()
    Reflect.deleteProperty(navigator, "serviceWorker")
  })

  it("ignores the same build and dev builds", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ sha: "abc1234" }) })
    vi.stubGlobal("fetch", fetch)
    start()
    tap()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(VERSION_POLL_MS)
    })
    vi.advanceTimersByTime(IDLE_APPLY_MS)
    expect(fetch).toHaveBeenCalled()
    expect(applyAppUpdate).not.toHaveBeenCalled()
  })
})

describe("recovering from a missing page file", () => {
  it("reloads to fetch the new build when a lazy page file has gone", () => {
    start()
    const event = new Event("vite:preloadError", { cancelable: true })
    act(() => {
      window.dispatchEvent(event)
    })
    expect(event.defaultPrevented).toBe(true)
    expect(applyAppUpdate).toHaveBeenCalledWith("chunk-error")
  })

  it("lets the error through if a reload was just tried on this build", () => {
    sessionStorage.setItem(
      "manaaki:update:attempt",
      JSON.stringify({ sha: "abc1234", at: Date.now() })
    )
    start()
    const event = new Event("vite:preloadError", { cancelable: true })
    act(() => {
      window.dispatchEvent(event)
    })
    expect(event.defaultPrevented).toBe(false)
    expect(applyAppUpdate).not.toHaveBeenCalled()
  })
})

describe("reporting to analytics", () => {
  const applied = {
    trigger: "navigation" as const,
    source: "worker-waiting" as const,
    heldMs: 1200,
    fromSha: "abc1234",
    toSha: "def5678",
    activation: "activated" as const,
    updated: true,
  }

  it("reports a completed update with how long it was held", () => {
    vi.mocked(takeAppliedUpdate).mockReturnValueOnce(applied)
    start()
    expect(analytics.capture).toHaveBeenCalledWith("app_updated", {
      trigger: "navigation",
      source: "worker-waiting",
      held_ms: 1200,
      from_sha: "abc1234",
      to_sha: "def5678",
      activation: "activated",
    })
    expect(analytics.histogram).toHaveBeenCalledWith("app_update.held.duration", 1200, {
      unit: "ms",
      attributes: { trigger: "navigation" },
    })
    expect(analytics.count).toHaveBeenCalledWith("app_update.applied", 1, {
      attributes: { trigger: "navigation", activation: "activated" },
    })
  })

  it("reports a reload that came back on the same build as a failed update", () => {
    vi.mocked(takeAppliedUpdate).mockReturnValueOnce({
      ...applied,
      toSha: "abc1234",
      activation: "timeout",
      updated: false,
    })
    start()
    expect(analytics.capture).toHaveBeenCalledWith(
      "app_update_failed",
      expect.objectContaining({ trigger: "navigation", activation: "timeout", to_sha: "abc1234" })
    )
    expect(analytics.capture).not.toHaveBeenCalledWith("app_updated", expect.anything())
    expect(analytics.count).toHaveBeenCalledWith("app_update.failed", 1, {
      attributes: { trigger: "navigation", activation: "timeout" },
    })
  })

  it("reports each update once when it is first found", () => {
    start()
    tap()
    act(() => markUpdatePending("worker-waiting"))
    act(() => markUpdatePending("worker-activated"))
    const detected = analytics.capture.mock.calls.filter(
      ([event]) => event === "app_update_detected"
    )
    expect(detected).toEqual([
      ["app_update_detected", { source: "worker-waiting", from_sha: "abc1234" }],
    ])
  })

  it("counts each reason that held an update back once per trigger", () => {
    start()
    tap()
    act(() => markUpdatePending("worker-waiting"))
    const release = holdAppUpdate("timer")
    act(() => {
      vi.advanceTimersByTime(IDLE_APPLY_MS + IDLE_CHECK_MS * 3)
    })
    const heldBack = analytics.count.mock.calls.filter(([name]) => name === "app_update.held_back")
    expect(heldBack).toEqual([
      ["app_update.held_back", 1, { attributes: { trigger: "idle", reason: "timer" } }],
    ])
    release()
  })

  it("reports the fallback prompt with how long the update waited", async () => {
    start()
    tap()
    act(() => markUpdatePending("worker-waiting"))
    const release = holdAppUpdate("timer")
    act(() => {
      vi.advanceTimersByTime(FALLBACK_PROMPT_MS)
    })
    expect(analytics.capture).toHaveBeenCalledWith("app_update_prompt_shown", {
      held_ms: FALLBACK_PROMPT_MS,
    })
    release()
  })

  it.each([
    ["newer", { ok: true, json: async () => ({ sha: "new9999" }) }],
    ["same", { ok: true, json: async () => ({ sha: "abc1234" }) }],
    ["failed", { ok: false }],
  ])("counts a %s version check", async (outcome, response) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response))
    start()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(VERSION_POLL_MS)
    })
    expect(analytics.count).toHaveBeenCalledWith("app_update.version_check", 1, {
      attributes: { outcome },
    })
  })

  it("counts missing-file recoveries and the ones the loop guard stopped", () => {
    start()
    act(() => {
      window.dispatchEvent(new Event("vite:preloadError", { cancelable: true }))
    })
    sessionStorage.setItem(
      "manaaki:update:attempt",
      JSON.stringify({ sha: "abc1234", at: Date.now() })
    )
    act(() => {
      window.dispatchEvent(new Event("vite:preloadError", { cancelable: true }))
    })
    sessionStorage.removeItem("manaaki:update:attempt")
    expect(analytics.count).toHaveBeenCalledWith("app_update.missing_file", 1, {
      attributes: { outcome: "reloaded" },
    })
    expect(analytics.count).toHaveBeenCalledWith("app_update.missing_file", 1, {
      attributes: { outcome: "loop_guarded" },
    })
  })
})
