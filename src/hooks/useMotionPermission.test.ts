import { act, renderHook } from "@testing-library/react"
import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useMotionPermission } from "./useMotionPermission"

function defineDeviceMotionEvent(requestPermission?: () => Promise<"granted" | "denied">) {
  Object.defineProperty(window, "DeviceMotionEvent", {
    value: requestPermission ? { requestPermission } : {},
    configurable: true,
    writable: true,
  })
}

function removeDeviceMotionEvent() {
  Object.defineProperty(window, "DeviceMotionEvent", {
    value: undefined,
    configurable: true,
    writable: true,
  })
}

describe("useMotionPermission", () => {
  it("renders the unavailable fallback on the server", () => {
    defineDeviceMotionEvent()
    function PermissionState() {
      return createElement("span", null, useMotionPermission().state)
    }
    expect(renderToString(createElement(PermissionState))).toBe("<span>unavailable</span>")
  })
  afterEach(() => {
    vi.restoreAllMocks()
    defineDeviceMotionEvent()
  })

  describe("on Android / non-iOS (no requestPermission method)", () => {
    beforeEach(() => defineDeviceMotionEvent())

    it("reports granted immediately", () => {
      const { result } = renderHook(() => useMotionPermission())
      expect(result.current.state).toBe("granted")
    })

    it("request() is a no-op that stays granted", async () => {
      const { result } = renderHook(() => useMotionPermission())
      await act(() => result.current.request())
      expect(result.current.state).toBe("granted")
    })
  })

  describe("on iOS 13+ (requestPermission exists)", () => {
    it("reports prompt initially", () => {
      defineDeviceMotionEvent(() => Promise.resolve("granted"))
      const { result } = renderHook(() => useMotionPermission())
      expect(result.current.state).toBe("prompt")
    })

    it("transitions to granted when permission is approved", async () => {
      defineDeviceMotionEvent(() => Promise.resolve("granted"))
      const { result } = renderHook(() => useMotionPermission())
      await act(() => result.current.request())
      expect(result.current.state).toBe("granted")
    })

    it("transitions to denied when permission is declined", async () => {
      defineDeviceMotionEvent(() => Promise.resolve("denied"))
      const { result } = renderHook(() => useMotionPermission())
      await act(() => result.current.request())
      expect(result.current.state).toBe("denied")
    })

    it("transitions to denied when requestPermission throws (e.g. non-secure context)", async () => {
      defineDeviceMotionEvent(() => Promise.reject(new Error("Not allowed")))
      const { result } = renderHook(() => useMotionPermission())
      await act(() => result.current.request())
      expect(result.current.state).toBe("denied")
    })
  })

  describe("remembering a previous grant across reloads", () => {
    const GRANTED_STORAGE_KEY = "manaaki:motion-granted"

    it("remembers that the user granted permission", async () => {
      defineDeviceMotionEvent(() => Promise.resolve("granted"))
      const { result } = renderHook(() => useMotionPermission())
      await act(() => result.current.request())
      expect(localStorage.getItem(GRANTED_STORAGE_KEY)).toBe("true")
    })

    it("re-requests permission on the first click when previously granted", async () => {
      localStorage.setItem(GRANTED_STORAGE_KEY, "true")
      const requestPermission = vi.fn(() => Promise.resolve("granted" as const))
      defineDeviceMotionEvent(requestPermission)
      const { result } = renderHook(() => useMotionPermission())
      expect(result.current.state).toBe("prompt")

      await act(async () => {
        document.body.click()
      })

      expect(requestPermission).toHaveBeenCalledTimes(1)
      expect(result.current.state).toBe("granted")
    })

    it("re-requests permission on the first touchend when previously granted", async () => {
      localStorage.setItem(GRANTED_STORAGE_KEY, "true")
      const requestPermission = vi.fn(() => Promise.resolve("granted" as const))
      defineDeviceMotionEvent(requestPermission)
      renderHook(() => useMotionPermission())

      await act(async () => {
        document.body.dispatchEvent(new Event("touchend", { bubbles: true }))
      })

      expect(requestPermission).toHaveBeenCalledTimes(1)
    })

    it("only re-requests once across several gestures", async () => {
      localStorage.setItem(GRANTED_STORAGE_KEY, "true")
      const requestPermission = vi.fn(() => Promise.resolve("granted" as const))
      defineDeviceMotionEvent(requestPermission)
      renderHook(() => useMotionPermission())

      await act(async () => {
        document.body.dispatchEvent(new Event("touchend", { bubbles: true }))
        document.body.click()
      })
      await act(async () => {
        document.body.click()
      })

      expect(requestPermission).toHaveBeenCalledTimes(1)
    })

    it("does not request permission on click when it was never granted", async () => {
      const requestPermission = vi.fn(() => Promise.resolve("granted" as const))
      defineDeviceMotionEvent(requestPermission)
      const { result } = renderHook(() => useMotionPermission())

      await act(async () => {
        document.body.click()
      })

      expect(requestPermission).not.toHaveBeenCalled()
      expect(result.current.state).toBe("prompt")
    })

    it("forgets the grant when the re-request is denied", async () => {
      localStorage.setItem(GRANTED_STORAGE_KEY, "true")
      defineDeviceMotionEvent(() => Promise.resolve("denied"))
      const { result } = renderHook(() => useMotionPermission())

      await act(async () => {
        document.body.click()
      })

      expect(result.current.state).toBe("denied")
      expect(localStorage.getItem(GRANTED_STORAGE_KEY)).toBeNull()
    })

    it("stops listening for gestures when unmounted", async () => {
      localStorage.setItem(GRANTED_STORAGE_KEY, "true")
      const requestPermission = vi.fn(() => Promise.resolve("granted" as const))
      defineDeviceMotionEvent(requestPermission)
      const { unmount } = renderHook(() => useMotionPermission())
      unmount()

      document.body.click()

      expect(requestPermission).not.toHaveBeenCalled()
    })
  })

  describe("when DeviceMotionEvent is absent (desktop browser)", () => {
    beforeEach(() => removeDeviceMotionEvent())

    it("reports unavailable", () => {
      const { result } = renderHook(() => useMotionPermission())
      expect(result.current.state).toBe("unavailable")
    })
  })
})
