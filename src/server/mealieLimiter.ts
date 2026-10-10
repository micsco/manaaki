import { mealieConcurrencyLimit, mealieQueueTimeoutMs } from "./env"

const DEFAULT_MAX_WAITING = 200

export class MealieBusyError extends Error {
  override name = "MealieBusyError"
}

export type MealieSlot = {
  release: () => void
  releaseAfter: (delayMs: number) => void
}

type LimiterOptions = {
  limit: () => number
  queueTimeoutMs: () => number
  maxWaiting?: number
}

export function createLimiter({
  limit,
  queueTimeoutMs,
  maxWaiting = DEFAULT_MAX_WAITING,
}: LimiterOptions) {
  let active = 0
  const waiting: (() => void)[] = []

  function slot(): MealieSlot {
    let released = false
    const release = () => {
      if (released) return
      released = true
      const grantNext = waiting.shift()
      if (grantNext) grantNext()
      else active--
    }
    return {
      release,
      releaseAfter: delayMs => {
        setTimeout(release, delayMs).unref?.()
      },
    }
  }

  function acquire(signal?: AbortSignal): Promise<MealieSlot> {
    if (signal?.aborted) return Promise.reject(signal.reason)
    if (active < limit()) {
      active++
      return Promise.resolve(slot())
    }
    if (waiting.length >= maxWaiting) {
      return Promise.reject(new MealieBusyError("Too many requests are waiting for Mealie"))
    }
    return new Promise((resolve, reject) => {
      const stopWaiting = () => {
        clearTimeout(timer)
        signal?.removeEventListener("abort", abandon)
        const position = waiting.indexOf(grant)
        if (position !== -1) waiting.splice(position, 1)
      }
      const grant = () => {
        stopWaiting()
        resolve(slot())
      }
      const abandon = () => {
        stopWaiting()
        reject(signal?.reason)
      }
      const timer = setTimeout(() => {
        stopWaiting()
        reject(new MealieBusyError("Waited too long for Mealie to have capacity"))
      }, queueTimeoutMs())
      signal?.addEventListener("abort", abandon, { once: true })
      waiting.push(grant)
    })
  }

  return { acquire }
}

export const mealieLimiter = createLimiter({
  limit: mealieConcurrencyLimit,
  queueTimeoutMs: mealieQueueTimeoutMs,
})
