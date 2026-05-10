import { renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useShakeDetection } from "./useShakeDetection"

type MotionHandler = (event: DeviceMotionEvent) => void

function motionEvent(x: number, y: number, z: number, gravityOnly = false): DeviceMotionEvent {
  const vec = { x, y, z }
  return {
    acceleration: gravityOnly ? { x: null, y: null, z: null } : vec,
    accelerationIncludingGravity: vec,
  } as unknown as DeviceMotionEvent
}

function shake(handler: MotionHandler | null, axis: "x" | "y" | "z", mag: number) {
  const pos: [number, number, number] =
    axis === "x" ? [mag, 0, 0] : axis === "y" ? [0, mag, 0] : [0, 0, mag]
  const neg: [number, number, number] =
    axis === "x" ? [-mag, 0, 0] : axis === "y" ? [0, -mag, 0] : [0, 0, -mag]
  handler?.(motionEvent(...pos))
  vi.advanceTimersByTime(80)
  handler?.(motionEvent(...neg))
  vi.advanceTimersByTime(80)
  handler?.(motionEvent(...pos))
}

describe("useShakeDetection", () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>
  let capturedHandler: MotionHandler | null

  beforeEach(() => {
    capturedHandler = null
    vi.useFakeTimers()
    addEventListenerSpy = vi
      .spyOn(window, "addEventListener")
      .mockImplementation((type: string, handler: EventListenerOrEventListenerObject) => {
        if (type === "devicemotion") capturedHandler = handler as MotionHandler
      })
    removeEventListenerSpy = vi.spyOn(window, "removeEventListener").mockImplementation(vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it("registers a devicemotion listener when enabled", () => {
    const onShake = vi.fn()
    renderHook(() => useShakeDetection({ onShake }))
    expect(addEventListenerSpy).toHaveBeenCalledWith("devicemotion", expect.any(Function))
  })

  it("does not register a listener when disabled", () => {
    const onShake = vi.fn()
    renderHook(() => useShakeDetection({ onShake, enabled: false }))
    const registered = addEventListenerSpy.mock.calls.some(
      ([type]: [string, ...unknown[]]) => type === "devicemotion"
    )
    expect(registered).toBe(false)
  })

  it("fires after three direction reversals within the window", () => {
    const onShake = vi.fn()
    renderHook(() => useShakeDetection({ onShake }))
    shake(capturedHandler, "x", 20)
    expect(onShake).toHaveBeenCalledTimes(1)
  })

  it("fires when dominant axis changes (chaotic shake)", () => {
    const onShake = vi.fn()
    renderHook(() => useShakeDetection({ onShake }))
    capturedHandler?.(motionEvent(20, 0, 0))
    vi.advanceTimersByTime(80)
    capturedHandler?.(motionEvent(0, 20, 0))
    vi.advanceTimersByTime(80)
    capturedHandler?.(motionEvent(0, 0, 20))
    expect(onShake).toHaveBeenCalledTimes(1)
  })

  it("does not fire on a single high-magnitude spike", () => {
    const onShake = vi.fn()
    renderHook(() => useShakeDetection({ onShake }))
    capturedHandler?.(motionEvent(20, 0, 0))
    expect(onShake).not.toHaveBeenCalled()
  })

  it("does not fire when the same direction repeats without reversal", () => {
    const onShake = vi.fn()
    renderHook(() => useShakeDetection({ onShake }))
    capturedHandler?.(motionEvent(20, 0, 0))
    vi.advanceTimersByTime(80)
    capturedHandler?.(motionEvent(20, 0, 0))
    vi.advanceTimersByTime(80)
    capturedHandler?.(motionEvent(20, 0, 0))
    expect(onShake).not.toHaveBeenCalled()
  })

  it("does not fire when jerks are spread beyond the window", () => {
    const onShake = vi.fn()
    renderHook(() => useShakeDetection({ onShake }))
    capturedHandler?.(motionEvent(20, 0, 0))
    vi.advanceTimersByTime(300)
    capturedHandler?.(motionEvent(-20, 0, 0))
    vi.advanceTimersByTime(300)
    capturedHandler?.(motionEvent(20, 0, 0))
    expect(onShake).not.toHaveBeenCalled()
  })

  it("does not fire for low-magnitude motion", () => {
    const onShake = vi.fn()
    renderHook(() => useShakeDetection({ onShake }))
    capturedHandler?.(motionEvent(5, 0, 0))
    vi.advanceTimersByTime(80)
    capturedHandler?.(motionEvent(-5, 0, 0))
    vi.advanceTimersByTime(80)
    capturedHandler?.(motionEvent(5, 0, 0))
    expect(onShake).not.toHaveBeenCalled()
  })

  it("does not re-fire within the debounce window", () => {
    const onShake = vi.fn()
    renderHook(() => useShakeDetection({ onShake }))
    shake(capturedHandler, "x", 20)
    expect(onShake).toHaveBeenCalledTimes(1)
    shake(capturedHandler, "x", 20)
    expect(onShake).toHaveBeenCalledTimes(1)
  })

  it("fires again after the debounce window has passed", () => {
    const onShake = vi.fn()
    renderHook(() => useShakeDetection({ onShake }))
    shake(capturedHandler, "x", 20)
    expect(onShake).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1100)
    shake(capturedHandler, "x", 20)
    expect(onShake).toHaveBeenCalledTimes(2)
  })

  it("falls back to accelerationIncludingGravity when acceleration is zero", () => {
    const onShake = vi.fn()
    renderHook(() => useShakeDetection({ onShake }))
    capturedHandler?.(motionEvent(20, 0, 0, true))
    vi.advanceTimersByTime(80)
    capturedHandler?.(motionEvent(-20, 0, 0, true))
    vi.advanceTimersByTime(80)
    capturedHandler?.(motionEvent(20, 0, 0, true))
    expect(onShake).toHaveBeenCalledTimes(1)
  })

  it("does not fire when accelerationIncludingGravity is null", () => {
    const onShake = vi.fn()
    renderHook(() => useShakeDetection({ onShake }))
    capturedHandler?.({
      acceleration: null,
      accelerationIncludingGravity: null,
    } as unknown as DeviceMotionEvent)
    expect(onShake).not.toHaveBeenCalled()
  })

  it("removes the devicemotion listener on unmount", () => {
    const onShake = vi.fn()
    const { unmount } = renderHook(() => useShakeDetection({ onShake }))
    unmount()
    expect(removeEventListenerSpy).toHaveBeenCalledWith("devicemotion", expect.any(Function))
  })
})
