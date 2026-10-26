import { mealieConcurrencyLimit, mealieQueueTimeoutMs } from "./env"
import { metrics } from "./telemetry"

const DEFAULT_MAX_WAITING = 200

export class MealieBusyError extends Error {
  override name = "MealieBusyError"
}

export type MealieSlot = {
  release: () => void
  releaseAfter: (delayMs: number) => void
}

export type LimiterUsage = { active: number; waiting: number }

type LimiterOptions = {
  limit: () => number
  queueTimeoutMs: () => number
  maxWaiting?: number
  onUsageChange?: (usage: LimiterUsage) => void
}

export function createLimiter({
  limit,
  queueTimeoutMs,
  maxWaiting = DEFAULT_MAX_WAITING,
  onUsageChange = () => {},
}: LimiterOptions) {
  let active = 0
  const waiting: (() => void)[] = []
  const reportUsage = () => onUsageChange({ active, waiting: waiting.length })

  function slot(): MealieSlot {
    let released = false
    const release = () => {
      if (released) return
      released = true
      const grantNext = waiting.shift()
      if (grantNext) grantNext()
      else {
        active--
        reportUsage()
      }
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
      reportUsage()
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
        reportUsage()
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
      reportUsage()
    })
  }

  return { acquire, hasCapacity: () => active < limit() }
}

export function reportMealieUsage({ active, waiting }: LimiterUsage) {
  metrics.gauge("mealie.slots.active", active)
  metrics.gauge("mealie.slots.waiting", waiting)
}

export const mealieLimiter = createLimiter({
  limit: mealieConcurrencyLimit,
  queueTimeoutMs: mealieQueueTimeoutMs,
  onUsageChange: reportMealieUsage,
})
