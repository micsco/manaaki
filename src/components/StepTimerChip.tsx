import { mdiCheck, mdiPause, mdiPlay, mdiTimerOutline } from "@mdi/js"
import { type MouseEvent, useCallback } from "react"

import { useTimer } from "../contexts/TimerContext"
import { formatTimerDisplay } from "../utils/timer"
import { Icon } from "./Icon"

export interface StepTimerChipProps {
  timerId: string
  recipeId: string
  stepIndex: number
  label: string
  rawDurationText: string
  seconds: number
}

export function StepTimerChip({
  timerId,
  recipeId,
  stepIndex,
  label,
  rawDurationText,
  seconds,
}: StepTimerChipProps) {
  const { getTimer, startTimer, pauseTimer, resumeTimer, resetTimer } = useTimer()
  const timer = getTimer(timerId)

  const handleClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation()

      if (!timer) {
        startTimer({
          id: timerId,
          recipeId,
          stepIndex,
          label,
          totalSeconds: seconds,
        })
        return
      }

      if (timer.status === "running") {
        pauseTimer(timerId)
        return
      }

      if (timer.status === "paused") {
        resumeTimer(timerId)
        return
      }

      if (timer.status === "completed") {
        resetTimer(timerId)
      }
    },
    [
      timer,
      timerId,
      recipeId,
      stepIndex,
      label,
      seconds,
      startTimer,
      pauseTimer,
      resumeTimer,
      resetTimer,
    ]
  )

  if (!timer) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-orange-800/60 bg-orange-950/60 px-2 py-0.5 align-baseline text-xs font-medium text-orange-400 transition-colors hover:border-orange-700 hover:bg-orange-900/60 hover:text-orange-300 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500"
        aria-label={`Start timer for ${rawDurationText}`}
      >
        <Icon path={mdiTimerOutline} size={0.5} aria-hidden />
        <span>{rawDurationText}</span>
      </button>
    )
  }

  if (timer.status === "running") {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-orange-500 bg-orange-900/80 px-2 py-0.5 align-baseline text-xs font-semibold text-orange-100 tabular-nums shadow-sm transition-colors hover:bg-orange-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-400"
        aria-label={`Timer running: ${formatTimerDisplay(timer.remainingSeconds)}, click to pause`}
      >
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-orange-400" />
        <Icon path={mdiPause} size={0.45} aria-hidden />
        <span>{formatTimerDisplay(timer.remainingSeconds)}</span>
      </button>
    )
  }

  if (timer.status === "paused") {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-amber-600/70 bg-amber-950/80 px-2 py-0.5 align-baseline text-xs font-medium text-amber-300 tabular-nums transition-colors hover:bg-amber-900 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-500"
        aria-label={`Timer paused: ${formatTimerDisplay(timer.remainingSeconds)}, click to resume`}
      >
        <Icon path={mdiPlay} size={0.5} aria-hidden />
        <span>{formatTimerDisplay(timer.remainingSeconds)}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-green-600/70 bg-green-950/80 px-2 py-0.5 align-baseline text-xs font-medium text-green-300 transition-colors hover:bg-green-900 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-green-500"
      aria-label="Timer completed, click to reset"
    >
      <Icon path={mdiCheck} size={0.5} aria-hidden />
      <span>Done</span>
    </button>
  )
}
