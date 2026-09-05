import { mdiBellRingOutline, mdiClose, mdiPause, mdiPlay, mdiPlus, mdiRestart } from "@mdi/js"

import { useTimer } from "../contexts/TimerContext"
import { formatTimerDisplay } from "../utils/timer"
import { Icon } from "./Icon"

export function KitchenTimerHUD() {
  const {
    timers,
    isAlarmRinging,
    silenceAlarm,
    pauseTimer,
    resumeTimer,
    resetTimer,
    addMinute,
    dismissTimer,
  } = useTimer()

  if (timers.length === 0) {
    return null
  }

  return (
    <aside
      aria-label="Active kitchen timers"
      className="pointer-events-none fixed right-4 bottom-[calc(var(--app-navigation-height,0px)+env(safe-area-inset-bottom,0px)+1rem)] z-40 flex w-[calc(100%-2rem)] max-w-xs flex-col gap-2.5 sm:right-6"
    >
      {timers.map(timer => {
        const isRunning = timer.status === "running"
        const isPaused = timer.status === "paused"
        const isCompleted = timer.status === "completed"

        const progressPercent =
          timer.totalSeconds > 0
            ? Math.min(100, Math.max(0, (timer.remainingSeconds / timer.totalSeconds) * 100))
            : 0

        return (
          <div
            key={timer.id}
            className={`pointer-events-auto rounded-2xl border bg-gray-900/95 p-3.5 shadow-2xl backdrop-blur-md transition-all ${
              isCompleted ? "border-green-500 shadow-green-950/40" : "border-gray-700"
            }`}
            role="region"
            aria-label={`Timer: ${timer.label}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-semibold tracking-wider text-gray-400 uppercase">
                {timer.label}
              </span>
              <button
                type="button"
                onClick={() => dismissTimer(timer.id)}
                className="cursor-pointer rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-200 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-gray-400"
                aria-label={`Dismiss timer ${timer.label}`}
              >
                <Icon path={mdiClose} size={0.55} aria-hidden />
              </button>
            </div>

            <div className="mt-1 flex items-baseline justify-between gap-2">
              <span
                className={`font-mono text-3xl font-bold tracking-tight tabular-nums ${
                  isCompleted
                    ? "animate-pulse text-green-400"
                    : isRunning
                      ? "text-orange-400"
                      : "text-amber-400"
                }`}
              >
                {formatTimerDisplay(timer.remainingSeconds)}
              </span>

              {isCompleted && (
                <span className="inline-flex items-center gap-1 rounded-full border border-green-700 bg-green-950 px-2 py-0.5 text-xs font-semibold text-green-400">
                  {isAlarmRinging && <Icon path={mdiBellRingOutline} size={0.45} aria-hidden />}
                  <span>Done!</span>
                </span>
              )}

              {isPaused && (
                <span className="rounded-full border border-amber-800 bg-amber-950 px-2 py-0.5 text-xs font-medium text-amber-300">
                  Paused
                </span>
              )}
            </div>

            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-800">
              <div
                className={`h-full transition-all duration-300 ${
                  isCompleted ? "w-full bg-green-500" : isRunning ? "bg-orange-500" : "bg-amber-500"
                }`}
                style={{ width: `${isCompleted ? 100 : progressPercent}%` }}
              />
            </div>

            <div className="mt-3 flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => addMinute(timer.id, 60)}
                className="inline-flex cursor-pointer items-center gap-0.5 rounded-lg border border-gray-700 bg-gray-800/80 px-2 py-1 text-xs font-medium text-gray-200 transition-colors hover:bg-gray-700 hover:text-white focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500"
                aria-label={`Add one minute to timer ${timer.label}`}
              >
                <Icon path={mdiPlus} size={0.45} aria-hidden />
                <span>1m</span>
              </button>

              <button
                type="button"
                onClick={() => resetTimer(timer.id)}
                className="inline-flex cursor-pointer items-center rounded-lg border border-gray-700 bg-gray-800/80 p-1 text-gray-300 transition-colors hover:bg-gray-700 hover:text-white focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500"
                aria-label={`Reset timer ${timer.label}`}
              >
                <Icon path={mdiRestart} size={0.55} aria-hidden />
              </button>

              {isCompleted && isAlarmRinging ? (
                <button
                  type="button"
                  onClick={silenceAlarm}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-green-500 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-green-400"
                  aria-label={`Silence alarm for ${timer.label}`}
                >
                  <Icon path={mdiBellRingOutline} size={0.5} aria-hidden />
                  <span>Silence</span>
                </button>
              ) : isRunning ? (
                <button
                  type="button"
                  onClick={() => pauseTimer(timer.id)}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-orange-600 px-2.5 py-1 text-xs font-medium text-white shadow-xs transition-colors hover:bg-orange-500 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-400"
                  aria-label={`Pause timer ${timer.label}`}
                >
                  <Icon path={mdiPause} size={0.5} aria-hidden />
                  <span>Pause</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => resumeTimer(timer.id)}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white shadow-xs transition-colors hover:bg-emerald-500 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-400"
                  aria-label={`Resume timer ${timer.label}`}
                >
                  <Icon path={mdiPlay} size={0.5} aria-hidden />
                  <span>Resume</span>
                </button>
              )}
            </div>
          </div>
        )
      })}
    </aside>
  )
}
