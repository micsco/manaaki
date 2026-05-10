import { renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useShakeDetection } from "./useShakeDetection"

type MotionHandler = (event: DeviceMotionEvent) => void

function makeMotionEvent(x: number, y: number, z: number): DeviceMotionEvent {
  return {
    accelerationIncludingGravity: { x, y, z },
  } as unknown as DeviceMotionEvent
}

describe("useShakeDetection", () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>
  let capturedHandler: MotionHandler | null

  beforeEach(() => {
    capturedHandler = null
    addEventListenerSpy = vi
      .spyOn(window, "addEventListener")
      .mockImplementation((type: string, handler: EventListenerOrEventListenerObject) => {
        if (type === "devicemotion") {
          capturedHandler = handler as MotionHandler
        }
      })
    removeEventListenerSpy = vi.spyOn(window, "removeEventListener").mockImplementation(vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("registers a devicemotion listener when enabled", () => {
    const onShake = vi.fn()
    renderHook(() => useShakeDetection({ onShake }))
    expect(addEventListenerSpy).toHaveBeenCalledWith("devicemotion", expect.any(Function))
  })

  it("does not register a listener when disabled", () => {
    const onShake = vi.fn()
    renderHook(() => useShakeDetection({ onShake, enabled: false }))
    const calledWithMotion = addEventListenerSpy.mock.calls.some(
      ([type]: [string, ...unknown[]]) => type === "devicemotion"
    )
    expect(calledWithMotion).toBe(false)
  })

  it("calls onShake when acceleration exceeds the threshold", () => {
    const onShake = vi.fn()
    renderHook(() => useShakeDetection({ onShake }))
    capturedHandler?.(makeMotionEvent(0, 0, 20))
    expect(onShake).toHaveBeenCalledTimes(1)
  })

  it("does not call onShake when acceleration is below the threshold", () => {
    const onShake = vi.fn()
    renderHook(() => useShakeDetection({ onShake }))
    capturedHandler?.(makeMotionEvent(0, 0, 5))
    expect(onShake).not.toHaveBeenCalled()
  })

  it("debounces rapid shakes — only calls onShake once within the cooldown window", () => {
    vi.useFakeTimers()
    const onShake = vi.fn()
    renderHook(() => useShakeDetection({ onShake }))

    capturedHandler?.(makeMotionEvent(0, 0, 20))
    capturedHandler?.(makeMotionEvent(0, 0, 20))
    capturedHandler?.(makeMotionEvent(0, 0, 20))

    expect(onShake).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it("allows a second shake after the cooldown window has passed", () => {
    vi.useFakeTimers()
    const onShake = vi.fn()
    renderHook(() => useShakeDetection({ onShake }))

    capturedHandler?.(makeMotionEvent(0, 0, 20))
    expect(onShake).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1100)

    capturedHandler?.(makeMotionEvent(0, 0, 20))
    expect(onShake).toHaveBeenCalledTimes(2)

    vi.useRealTimers()
  })

  it("removes the devicemotion listener on unmount", () => {
    const onShake = vi.fn()
    const { unmount } = renderHook(() => useShakeDetection({ onShake }))
    unmount()
    expect(removeEventListenerSpy).toHaveBeenCalledWith("devicemotion", expect.any(Function))
  })

  it("does not call onShake when accelerationIncludingGravity is null", () => {
    const onShake = vi.fn()
    renderHook(() => useShakeDetection({ onShake }))
    capturedHandler?.({ accelerationIncludingGravity: null } as unknown as DeviceMotionEvent)
    expect(onShake).not.toHaveBeenCalled()
  })
})
