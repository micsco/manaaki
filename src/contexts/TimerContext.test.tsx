import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import * as audioModule from "../utils/audio"
import { TimerProvider, useTimer } from "./TimerContext"

vi.mock("../utils/audio", () => ({
  playKitchenChime: vi.fn(),
  startKitchenAlarm: vi.fn(),
  stopKitchenAlarm: vi.fn(),
  isKitchenAlarmActive: vi.fn().mockReturnValue(false),
}))

describe("TimerContext", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("throws error when used outside TimerProvider", () => {
    expect(() => renderHook(() => useTimer())).toThrow(
      "useTimer must be used within a TimerProvider"
    )
  })

  it("starts a new timer and tracks running state", () => {
    const { result } = renderHook(() => useTimer(), { wrapper: TimerProvider })

    act(() => {
      result.current.startTimer({
        id: "step-1-10m",
        label: "Step 1",
        totalSeconds: 600,
      })
    })

    expect(result.current.timers).toHaveLength(1)
    expect(result.current.timers[0]).toMatchObject({
      id: "step-1-10m",
      label: "Step 1",
      totalSeconds: 600,
      remainingSeconds: 600,
      status: "running",
    })
  })

  it("pauses and resumes a timer", () => {
    const { result } = renderHook(() => useTimer(), { wrapper: TimerProvider })

    act(() => {
      result.current.startTimer({
        id: "step-1",
        label: "Step 1",
        totalSeconds: 100,
      })
    })

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    act(() => {
      result.current.pauseTimer("step-1")
    })

    expect(result.current.timers[0]?.status).toBe("paused")
    const pausedSeconds = result.current.timers[0]?.remainingSeconds

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(result.current.timers[0]?.remainingSeconds).toBe(pausedSeconds)

    act(() => {
      result.current.resumeTimer("step-1")
    })

    expect(result.current.timers[0]?.status).toBe("running")
  })

  it("adds a minute to a running timer", () => {
    const { result } = renderHook(() => useTimer(), { wrapper: TimerProvider })

    act(() => {
      result.current.startTimer({
        id: "step-1",
        label: "Step 1",
        totalSeconds: 120,
      })
    })

    act(() => {
      result.current.addMinute("step-1", 60)
    })

    expect(result.current.timers[0]?.remainingSeconds).toBe(180)
    expect(result.current.timers[0]?.totalSeconds).toBe(180)
  })

  it("resets a timer to initial total seconds and pauses it", () => {
    const { result } = renderHook(() => useTimer(), { wrapper: TimerProvider })

    act(() => {
      result.current.startTimer({
        id: "step-1",
        label: "Step 1",
        totalSeconds: 60,
      })
    })

    act(() => {
      vi.advanceTimersByTime(10000)
    })

    act(() => {
      result.current.resetTimer("step-1")
    })

    expect(result.current.timers[0]?.remainingSeconds).toBe(60)
    expect(result.current.timers[0]?.status).toBe("paused")
  })

  it("dismisses a timer", () => {
    const { result } = renderHook(() => useTimer(), { wrapper: TimerProvider })

    act(() => {
      result.current.startTimer({
        id: "step-1",
        label: "Step 1",
        totalSeconds: 60,
      })
    })

    expect(result.current.timers).toHaveLength(1)

    act(() => {
      result.current.dismissTimer("step-1")
    })

    expect(result.current.timers).toHaveLength(0)
  })

  it("completes when remaining seconds reach 0 and starts kitchen alarm", () => {
    const { result } = renderHook(() => useTimer(), { wrapper: TimerProvider })

    act(() => {
      result.current.startTimer({
        id: "step-1",
        label: "Step 1",
        totalSeconds: 3,
      })
    })

    act(() => {
      vi.advanceTimersByTime(3500)
    })

    expect(result.current.timers[0]?.status).toBe("completed")
    expect(result.current.timers[0]?.remainingSeconds).toBe(0)
    expect(result.current.isAlarmRinging).toBe(true)
    expect(audioModule.startKitchenAlarm).toHaveBeenCalledTimes(1)
    expect(audioModule.startKitchenAlarm).toHaveBeenCalledWith(30000, expect.any(Function))
  })

  it("silences active alarm and sets isAlarmRinging to false", () => {
    const { result } = renderHook(() => useTimer(), { wrapper: TimerProvider })

    act(() => {
      result.current.startTimer({
        id: "step-1",
        label: "Step 1",
        totalSeconds: 2,
      })
    })

    act(() => {
      vi.advanceTimersByTime(2500)
    })

    expect(result.current.isAlarmRinging).toBe(true)

    act(() => {
      result.current.silenceAlarm()
    })

    expect(result.current.isAlarmRinging).toBe(false)
    expect(audioModule.stopKitchenAlarm).toHaveBeenCalled()
  })

  it("stops alarm when completed timer is dismissed", () => {
    const { result } = renderHook(() => useTimer(), { wrapper: TimerProvider })

    act(() => {
      result.current.startTimer({
        id: "step-1",
        label: "Step 1",
        totalSeconds: 1,
      })
    })

    act(() => {
      vi.advanceTimersByTime(1500)
    })

    expect(result.current.isAlarmRinging).toBe(true)

    act(() => {
      result.current.dismissTimer("step-1")
    })

    expect(result.current.isAlarmRinging).toBe(false)
    expect(audioModule.stopKitchenAlarm).toHaveBeenCalled()
  })

  it("stops alarm when completed timer is reset", () => {
    const { result } = renderHook(() => useTimer(), { wrapper: TimerProvider })

    act(() => {
      result.current.startTimer({
        id: "step-1",
        label: "Step 1",
        totalSeconds: 1,
      })
    })

    act(() => {
      vi.advanceTimersByTime(1500)
    })

    expect(result.current.isAlarmRinging).toBe(true)

    act(() => {
      result.current.resetTimer("step-1")
    })

    expect(result.current.isAlarmRinging).toBe(false)
    expect(audioModule.stopKitchenAlarm).toHaveBeenCalled()
  })

  it("gets timer by id helper", () => {
    const { result } = renderHook(() => useTimer(), { wrapper: TimerProvider })

    act(() => {
      result.current.startTimer({
        id: "step-test",
        label: "Test",
        totalSeconds: 30,
      })
    })

    const timer = result.current.getTimer("step-test")
    expect(timer?.id).toBe("step-test")
    expect(result.current.getTimer("non-existent")).toBeUndefined()
  })
})

it("restores timers after reopening and includes time spent away", async () => {
  vi.useFakeTimers()
  const first = renderHook(() => useTimer(), { wrapper: TimerProvider })
  await act(async () => {
    vi.runAllTicks()
  })
  act(() => first.result.current.startTimer({ id: "persisted", label: "Oven", totalSeconds: 600 }))
  first.unmount()
  vi.setSystemTime(Date.now() + 120_000)
  const second = renderHook(() => useTimer(), { wrapper: TimerProvider })
  await act(async () => {
    vi.runAllTicks()
  })
  expect(second.result.current.getTimer("persisted")?.remainingSeconds).toBe(480)
  second.unmount()
  vi.useRealTimers()
})

it("completes a restored timer that expired while the app was closed", async () => {
  vi.useFakeTimers()
  const first = renderHook(() => useTimer(), { wrapper: TimerProvider })
  await act(async () => {
    vi.runAllTicks()
  })
  act(() => first.result.current.startTimer({ id: "expired", label: "Oven", totalSeconds: 60 }))
  first.unmount()
  vi.setSystemTime(Date.now() + 120_000)
  const second = renderHook(() => useTimer(), { wrapper: TimerProvider })
  await act(async () => {
    vi.runAllTicks()
  })
  await act(async () => vi.advanceTimersByTimeAsync(250))
  expect(second.result.current.getTimer("expired")?.status).toBe("completed")
  second.unmount()
  vi.useRealTimers()
})
