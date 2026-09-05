import type { ActiveTimer } from "../contexts/TimerContext"

const KEY = "manaaki:cooking:v1:timers"

export function restoreTimers(): ActiveTimer[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]")
    if (!Array.isArray(value)) return []
    return value
      .filter(
        (timer): timer is ActiveTimer =>
          timer &&
          typeof timer.id === "string" &&
          typeof timer.label === "string" &&
          [timer.totalSeconds, timer.remainingSeconds, timer.pausedRemainingSeconds].every(
            value => Number.isFinite(value) && value >= 0
          ) &&
          ["running", "paused", "completed"].includes(timer.status) &&
          (timer.status === "running" ? Number.isFinite(timer.startedAt) : timer.startedAt === null)
      )
      .map(timer => {
        if (timer.status !== "running" || timer.startedAt === null) return timer
        const remainingSeconds = Math.max(
          0,
          timer.pausedRemainingSeconds -
            Math.floor(Math.max(0, Date.now() - timer.startedAt) / 1000)
        )
        return { ...timer, remainingSeconds }
      })
  } catch {
    return []
  }
}

export function persistTimers(timers: ActiveTimer[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(timers))
  } catch {}
}
