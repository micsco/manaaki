import { act, renderHook } from "@testing-library/react"
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

  describe("when DeviceMotionEvent is absent (desktop browser)", () => {
    beforeEach(() => removeDeviceMotionEvent())

    it("reports unavailable", () => {
      const { result } = renderHook(() => useMotionPermission())
      expect(result.current.state).toBe("unavailable")
    })
  })
})
