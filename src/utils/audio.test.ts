import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  isKitchenAlarmActive,
  playKitchenChime,
  resetAudioContextForTesting,
  startKitchenAlarm,
  stopKitchenAlarm,
} from "./audio"

describe("audio alarms and chimes", () => {
  const originalAudioContext = window.AudioContext

  beforeEach(() => {
    vi.useFakeTimers()
    resetAudioContextForTesting()
  })

  afterEach(() => {
    window.AudioContext = originalAudioContext
    resetAudioContextForTesting()
    vi.useRealTimers()
  })

  it("returns false if AudioContext is not supported", async () => {
    // @ts-expect-error simulating unsupported browser
    delete window.AudioContext

    const result = await playKitchenChime()
    expect(result).toBe(false)
  })

  it("plays triple-beep chime pattern when AudioContext is supported", async () => {
    const mockOscillator = {
      type: "sine",
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }
    const mockGain = {
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    }

    const mockContext = {
      currentTime: 10,
      state: "running",
      destination: {},
      resume: vi.fn().mockResolvedValue(undefined),
      createOscillator: vi.fn().mockReturnValue(mockOscillator),
      createGain: vi.fn().mockReturnValue(mockGain),
    }

    function MockAudioContext(this: object) {
      Object.assign(this, mockContext)
    }

    window.AudioContext = MockAudioContext as unknown as typeof AudioContext

    const result = await playKitchenChime()

    expect(result).toBe(true)
    expect(mockContext.createOscillator).toHaveBeenCalledTimes(3)
    expect(mockContext.createGain).toHaveBeenCalledTimes(3)
    expect(mockOscillator.start).toHaveBeenCalledTimes(3)
    expect(mockOscillator.stop).toHaveBeenCalledTimes(3)
    expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(1760, 10)
    expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(1760, 10.14)
    expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(2093, 10.28)
  })

  it("resumes context if suspended", async () => {
    const mockOscillator = {
      type: "sine",
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }
    const mockGain = {
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    }

    const mockContext = {
      currentTime: 0,
      state: "suspended",
      destination: {},
      resume: vi.fn().mockResolvedValue(undefined),
      createOscillator: vi.fn().mockReturnValue(mockOscillator),
      createGain: vi.fn().mockReturnValue(mockGain),
    }

    function MockAudioContext(this: object) {
      Object.assign(this, mockContext)
    }

    window.AudioContext = MockAudioContext as unknown as typeof AudioContext

    const result = await playKitchenChime()

    expect(result).toBe(true)
    expect(mockContext.resume).toHaveBeenCalled()
  })

  it("repeats alarm pattern periodically until stopped", () => {
    const mockOscillator = {
      type: "sine",
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }
    const mockGain = {
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    }

    const mockContext = {
      currentTime: 0,
      state: "running",
      destination: {},
      resume: vi.fn().mockResolvedValue(undefined),
      createOscillator: vi.fn().mockReturnValue(mockOscillator),
      createGain: vi.fn().mockReturnValue(mockGain),
    }

    function MockAudioContext(this: object) {
      Object.assign(this, mockContext)
    }

    window.AudioContext = MockAudioContext as unknown as typeof AudioContext

    startKitchenAlarm(30000)
    expect(isKitchenAlarmActive()).toBe(true)
    expect(mockContext.createOscillator).toHaveBeenCalledTimes(3)

    vi.advanceTimersByTime(1600)
    expect(mockContext.createOscillator).toHaveBeenCalledTimes(6)

    vi.advanceTimersByTime(1600)
    expect(mockContext.createOscillator).toHaveBeenCalledTimes(9)

    stopKitchenAlarm()
    expect(isKitchenAlarmActive()).toBe(false)

    vi.advanceTimersByTime(3200)
    expect(mockContext.createOscillator).toHaveBeenCalledTimes(9)
  })

  it("automatically stops alarm after max duration expires", () => {
    const onAutoStop = vi.fn()
    startKitchenAlarm(5000, onAutoStop)

    expect(isKitchenAlarmActive()).toBe(true)

    vi.advanceTimersByTime(5000)

    expect(isKitchenAlarmActive()).toBe(false)
    expect(onAutoStop).toHaveBeenCalledTimes(1)
  })
})
