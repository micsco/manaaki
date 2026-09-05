import { usePostHog } from "@posthog/react"
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"

import { playKitchenChime } from "../utils/audio"

export type TimerStatus = "running" | "paused" | "completed"

export interface ActiveTimer {
  id: string
  recipeId?: string
  stepIndex?: number
  label: string
  totalSeconds: number
  remainingSeconds: number
  status: TimerStatus
  startedAt: number | null
  pausedRemainingSeconds: number
}

export interface StartTimerOptions {
  id: string
  recipeId?: string
  stepIndex?: number
  label: string
  totalSeconds: number
}

export interface TimerContextType {
  timers: ActiveTimer[]
  startTimer: (options: StartTimerOptions) => void
  pauseTimer: (id: string) => void
  resumeTimer: (id: string) => void
  resetTimer: (id: string) => void
  addMinute: (id: string, additionalSeconds?: number) => void
  dismissTimer: (id: string) => void
  getTimer: (id: string) => ActiveTimer | undefined
}

const TimerContext = createContext<TimerContextType | undefined>(undefined)

export function useTimer(): TimerContextType {
  const context = useContext(TimerContext)
  if (context === undefined) {
    throw new Error("useTimer must be used within a TimerProvider")
  }
  return context
}

export interface TimerProviderProps {
  children: ReactNode
}

export function TimerProvider({ children }: TimerProviderProps) {
  const [timers, setTimers] = useState<ActiveTimer[]>([])
  const posthog = usePostHog()
  const posthogRef = useRef(posthog)
  posthogRef.current = posthog

  const startTimer = useCallback((options: StartTimerOptions) => {
    const { id, recipeId, stepIndex, label, totalSeconds } = options
    const now = Date.now()

    setTimers(prevTimers => {
      const existing = prevTimers.find(t => t.id === id)
      if (existing) {
        if (existing.status === "paused") {
          return prevTimers.map(t =>
            t.id === id
              ? {
                  ...t,
                  status: "running",
                  startedAt: now,
                  pausedRemainingSeconds: t.remainingSeconds,
                }
              : t
          )
        }
        return prevTimers
      }

      const newTimer: ActiveTimer = {
        id,
        recipeId,
        stepIndex,
        label,
        totalSeconds,
        remainingSeconds: totalSeconds,
        status: "running",
        startedAt: now,
        pausedRemainingSeconds: totalSeconds,
      }

      return [...prevTimers, newTimer]
    })

    try {
      posthogRef.current?.capture("recipe_timer_started", {
        recipe_id: recipeId,
        step_index: stepIndex,
        label,
        total_seconds: totalSeconds,
      })
    } catch {}
  }, [])

  const pauseTimer = useCallback((id: string) => {
    setTimers(prevTimers =>
      prevTimers.map(t => {
        if (t.id !== id || t.status !== "running") {
          return t
        }
        return {
          ...t,
          status: "paused",
          startedAt: null,
          pausedRemainingSeconds: t.remainingSeconds,
        }
      })
    )
  }, [])

  const resumeTimer = useCallback((id: string) => {
    const now = Date.now()
    setTimers(prevTimers =>
      prevTimers.map(t => {
        if (t.id !== id || t.status !== "paused") {
          return t
        }
        return {
          ...t,
          status: "running",
          startedAt: now,
          pausedRemainingSeconds: t.remainingSeconds,
        }
      })
    )
  }, [])

  const resetTimer = useCallback((id: string) => {
    setTimers(prevTimers =>
      prevTimers.map(t => {
        if (t.id !== id) {
          return t
        }
        return {
          ...t,
          status: "paused",
          startedAt: null,
          remainingSeconds: t.totalSeconds,
          pausedRemainingSeconds: t.totalSeconds,
        }
      })
    )
  }, [])

  const addMinute = useCallback((id: string, additionalSeconds = 60) => {
    const now = Date.now()
    setTimers(prevTimers =>
      prevTimers.map(t => {
        if (t.id !== id) {
          return t
        }
        const updatedTotal = t.totalSeconds + additionalSeconds
        const updatedRemaining = t.remainingSeconds + additionalSeconds
        return {
          ...t,
          totalSeconds: updatedTotal,
          remainingSeconds: updatedRemaining,
          pausedRemainingSeconds: updatedRemaining,
          status: "running",
          startedAt: now,
        }
      })
    )
  }, [])

  const dismissTimer = useCallback((id: string) => {
    setTimers(prevTimers => prevTimers.filter(t => t.id !== id))
  }, [])

  const getTimer = useCallback((id: string) => timers.find(t => t.id === id), [timers])

  useEffect(() => {
    const hasRunningTimers = timers.some(t => t.status === "running")
    if (!hasRunningTimers) {
      return
    }

    const intervalId = window.setInterval(() => {
      const now = Date.now()

      setTimers(prevTimers => {
        let hasChanges = false
        const nextTimers = prevTimers.map(timer => {
          if (timer.status !== "running" || timer.startedAt === null) {
            return timer
          }

          const elapsed = Math.floor((now - timer.startedAt) / 1000)
          const nextRemaining = Math.max(0, timer.pausedRemainingSeconds - elapsed)

          if (nextRemaining === timer.remainingSeconds) {
            return timer
          }

          hasChanges = true

          if (nextRemaining === 0) {
            playKitchenChime()
            try {
              posthogRef.current?.capture("recipe_timer_completed", {
                recipe_id: timer.recipeId,
                step_index: timer.stepIndex,
                label: timer.label,
                total_seconds: timer.totalSeconds,
              })
            } catch {}
            return {
              ...timer,
              remainingSeconds: 0,
              status: "completed" as const,
              startedAt: null,
              pausedRemainingSeconds: 0,
            }
          }

          return {
            ...timer,
            remainingSeconds: nextRemaining,
          }
        })

        return hasChanges ? nextTimers : prevTimers
      })
    }, 250)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [timers])

  return (
    <TimerContext.Provider
      value={{
        timers,
        startTimer,
        pauseTimer,
        resumeTimer,
        resetTimer,
        addMinute,
        dismissTimer,
        getTimer,
      }}
    >
      {children}
    </TimerContext.Provider>
  )
}
