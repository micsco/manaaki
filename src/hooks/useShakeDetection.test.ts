import { renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useShakeDetection } from "./useShakeDetection"

type MotionHandler = (event: DeviceMotionEvent) => void

function makeMotionEvent(x: number, y: number, z: number): DeviceMotionEvent {
  return {
    accelerationIncludingGravity: { x, y, z },
  } as unknown as DeviceMotionEvent
}

const HIGH = makeMotionEvent(0, 0, 20)
const LOW = makeMotionEvent(0, 0, 5)

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
        if (type === "devicemotion") {
          capturedHandler = handler as MotionHandler
        }
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
    const calledWithMotion = addEventListenerSpy.mock.calls.some(
      ([type]: [string, ...unknown[]]) => type === "devicemotion"
    )
    expect(calledWithMotion).toBe(false)
  })

  it("does not fire on a single high-magnitude spike", () => {
    const onShake = vi.fn()
    renderHook(() => useShakeDetection({ onShake }))
    capturedHandler?.(HIGH)
    expect(onShake).not.toHaveBeenCalled()
  })

  it("does not fire on two high-magnitude spikes", () => {
    const onShake = vi.fn()
    renderHook(() => useShakeDetection({ onShake }))
    capturedHandler?.(HIGH)
    vi.advanceTimersByTime(100)
    capturedHandler?.(HIGH)
    expect(onShake).not.toHaveBeenCalled()
  })

  it("fires after three high-magnitude spikes within the window", () => {
    const onShake = vi.fn()
    renderHook(() => useShakeDetection({ onShake }))
    capturedHandler?.(HIGH)
    vi.advanceTimersByTime(100)
    capturedHandler?.(HIGH)
    vi.advanceTimersByTime(100)
    capturedHandler?.(HIGH)
    expect(onShake).toHaveBeenCalledTimes(1)
  })

  it("does not fire when spikes are spread beyond the peak window", () => {
    const onShake = vi.fn()
    renderHook(() => useShakeDetection({ onShake }))
    capturedHandler?.(HIGH)
    vi.advanceTimersByTime(400)
    capturedHandler?.(HIGH)
    vi.advanceTimersByTime(400)
    capturedHandler?.(HIGH)
    expect(onShake).not.toHaveBeenCalled()
  })

  it("does not fire for low-magnitude motion regardless of count", () => {
    const onShake = vi.fn()
    renderHook(() => useShakeDetection({ onShake }))
    capturedHandler?.(LOW)
    capturedHandler?.(LOW)
    capturedHandler?.(LOW)
    expect(onShake).not.toHaveBeenCalled()
  })

  it("does not re-fire within the cooldown window after a shake", () => {
    const onShake = vi.fn()
    renderHook(() => useShakeDetection({ onShake }))

    capturedHandler?.(HIGH)
    vi.advanceTimersByTime(100)
    capturedHandler?.(HIGH)
    vi.advanceTimersByTime(100)
    capturedHandler?.(HIGH)
    expect(onShake).toHaveBeenCalledTimes(1)

    capturedHandler?.(HIGH)
    vi.advanceTimersByTime(100)
    capturedHandler?.(HIGH)
    vi.advanceTimersByTime(100)
    capturedHandler?.(HIGH)
    expect(onShake).toHaveBeenCalledTimes(1)
  })

  it("allows a second shake after the cooldown has passed", () => {
    const onShake = vi.fn()
    renderHook(() => useShakeDetection({ onShake }))

    capturedHandler?.(HIGH)
    vi.advanceTimersByTime(100)
    capturedHandler?.(HIGH)
    vi.advanceTimersByTime(100)
    capturedHandler?.(HIGH)
    expect(onShake).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1600)

    capturedHandler?.(HIGH)
    vi.advanceTimersByTime(100)
    capturedHandler?.(HIGH)
    vi.advanceTimersByTime(100)
    capturedHandler?.(HIGH)
    expect(onShake).toHaveBeenCalledTimes(2)
  })

  it("removes the devicemotion listener on unmount", () => {
    const onShake = vi.fn()
    const { unmount } = renderHook(() => useShakeDetection({ onShake }))
    unmount()
    expect(removeEventListenerSpy).toHaveBeenCalledWith("devicemotion", expect.any(Function))
  })

  it("does not fire when accelerationIncludingGravity is null", () => {
    const onShake = vi.fn()
    renderHook(() => useShakeDetection({ onShake }))
    capturedHandler?.({ accelerationIncludingGravity: null } as unknown as DeviceMotionEvent)
    expect(onShake).not.toHaveBeenCalled()
  })
})
