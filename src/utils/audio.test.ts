import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { playKitchenChime, resetAudioContextForTesting } from "./audio"

describe("playKitchenChime", () => {
  const originalAudioContext = window.AudioContext

  beforeEach(() => {
    vi.restoreAllMocks()
    resetAudioContextForTesting()
  })

  afterEach(() => {
    window.AudioContext = originalAudioContext
    resetAudioContextForTesting()
  })

  it("returns false if AudioContext is not supported", async () => {
    // @ts-expect-error simulating unsupported browser
    delete window.AudioContext

    const result = await playKitchenChime()
    expect(result).toBe(false)
  })

  it("plays dual chime tones when AudioContext is supported", async () => {
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
    expect(mockContext.createOscillator).toHaveBeenCalledTimes(4)
    expect(mockContext.createGain).toHaveBeenCalledTimes(4)
    expect(mockOscillator.start).toHaveBeenCalledTimes(4)
    expect(mockOscillator.stop).toHaveBeenCalledTimes(4)
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

  it("handles resume rejection gracefully", async () => {
    const mockContext = {
      currentTime: 0,
      state: "suspended",
      destination: {},
      resume: vi.fn().mockRejectedValue(new Error("Autoplay blocked")),
      createOscillator: vi.fn(),
      createGain: vi.fn(),
    }

    function MockAudioContext(this: object) {
      Object.assign(this, mockContext)
    }

    window.AudioContext = MockAudioContext as unknown as typeof AudioContext

    const result = await playKitchenChime()
    expect(result).toBe(false)
  })
})
