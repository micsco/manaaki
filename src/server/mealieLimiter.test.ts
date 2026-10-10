import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createLimiter, MealieBusyError, type MealieSlot } from "./mealieLimiter"

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

function settled<T>(promise: Promise<T>) {
  const state: { value?: T; error?: unknown; done: boolean } = { done: false }
  promise.then(
    value => Object.assign(state, { value, done: true }),
    (error: unknown) => Object.assign(state, { error, done: true })
  )
  return state
}

const tick = () => vi.advanceTimersByTimeAsync(0)

describe("createLimiter", () => {
  it("grants slots immediately up to the limit and queues the rest", async () => {
    const limiter = createLimiter({ limit: () => 2, queueTimeoutMs: () => 1000 })
    const first = settled(limiter.acquire())
    const second = settled(limiter.acquire())
    const third = settled(limiter.acquire())
    await tick()

    expect(first.done).toBe(true)
    expect(second.done).toBe(true)
    expect(third.done).toBe(false)
  })

  it("hands a released slot to the longest-waiting request", async () => {
    const limiter = createLimiter({ limit: () => 1, queueTimeoutMs: () => 1000 })
    const holder = await limiter.acquire()
    const order: string[] = []
    const earlier = limiter.acquire().then(slot => (order.push("earlier"), slot))
    const later = limiter.acquire().then(slot => (order.push("later"), slot))

    holder.release()
    ;(await earlier).release()
    ;(await later).release()

    expect(order).toEqual(["earlier", "later"])
  })

  it("never runs more than the limit, however requests arrive", async () => {
    const limiter = createLimiter({ limit: () => 3, queueTimeoutMs: () => 10_000 })
    let running = 0
    let peak = 0
    const work = Array.from({ length: 20 }, async () => {
      const slot = await limiter.acquire()
      running++
      peak = Math.max(peak, running)
      await new Promise(resolve => setTimeout(resolve, 10))
      running--
      slot.release()
    })

    await vi.advanceTimersByTimeAsync(200)
    await Promise.all(work)

    expect(peak).toBe(3)
  })

  it("ignores a second release of the same slot", async () => {
    const limiter = createLimiter({ limit: () => 1, queueTimeoutMs: () => 1000 })
    const holder = await limiter.acquire()
    holder.release()
    holder.release()

    const next = await limiter.acquire()
    const overflow = settled(limiter.acquire())
    await tick()

    expect(overflow.done).toBe(false)
    next.release()
  })

  it("rejects a request that waits longer than the queue timeout and forgets it", async () => {
    const limiter = createLimiter({ limit: () => 1, queueTimeoutMs: () => 1000 })
    const holder = await limiter.acquire()
    const waiting = settled(limiter.acquire())

    await vi.advanceTimersByTimeAsync(1000)

    expect(waiting.error).toBeInstanceOf(MealieBusyError)
    holder.release()
    const next = settled(limiter.acquire())
    await tick()
    expect(next.done).toBe(true)
  })

  it("rejects straight away once the queue is full", async () => {
    const limiter = createLimiter({ limit: () => 1, queueTimeoutMs: () => 1000, maxWaiting: 2 })
    await limiter.acquire()
    settled(limiter.acquire())
    settled(limiter.acquire())

    await expect(limiter.acquire()).rejects.toBeInstanceOf(MealieBusyError)
  })

  it("drops a queued request whose caller gives up", async () => {
    const limiter = createLimiter({ limit: () => 1, queueTimeoutMs: () => 1000 })
    const holder = await limiter.acquire()
    const caller = new AbortController()
    const abandoned = settled(limiter.acquire(caller.signal))
    const patient = settled(limiter.acquire())

    caller.abort(new Error("gone"))
    await tick()
    holder.release()
    await tick()

    expect(abandoned.error).toMatchObject({ message: "gone" })
    expect(patient.done).toBe(true)
    expect(patient.error).toBeUndefined()
  })

  it("refuses a caller that has already given up", async () => {
    const limiter = createLimiter({ limit: () => 1, queueTimeoutMs: () => 1000 })

    await expect(limiter.acquire(AbortSignal.abort(new Error("gone")))).rejects.toThrow("gone")
    const next = settled(limiter.acquire())
    await tick()
    expect(next.done).toBe(true)
  })

  it("keeps a slot occupied for the hold period when asked to release it later", async () => {
    const limiter = createLimiter({ limit: () => 1, queueTimeoutMs: () => 60_000 })
    const stalled: MealieSlot = await limiter.acquire()
    stalled.releaseAfter(30_000)
    const waiting = settled(limiter.acquire())

    await vi.advanceTimersByTimeAsync(29_999)
    expect(waiting.done).toBe(false)
    await vi.advanceTimersByTimeAsync(1)

    expect(waiting.done).toBe(true)
  })
})
