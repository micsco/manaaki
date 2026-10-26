import { useEffect, useState } from "react"

import type { DraftProgressEvent } from "../utils/recipeVersionDraft"

const STAGES = [
  { key: "reading", label: "Reading the recipe" },
  { key: "thinking", label: "Planning the new method" },
  { key: "writing", label: "Writing the steps" },
  { key: "fixing", label: "Fixing problems the checks found" },
  { key: "checking", label: "Running the automated checks" },
] as const

function stageIndex(progress: DraftProgressEvent | null): number {
  if (!progress) return 0
  return STAGES.findIndex(stage => stage.key === progress.stage)
}

function fixingLabel(problems: number, escalated: boolean): string {
  const count = `${problems} problem${problems === 1 ? "" : "s"}`
  return escalated ? `Asking a stronger model to fix ${count}` : `Fixing ${count} the checks found`
}

export function RecipeVersionProgress({
  progress,
  startedAt,
}: {
  progress: DraftProgressEvent | null
  startedAt: number
}) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const current = stageIndex(progress)
  const seconds = Math.max(0, Math.round((now - startedAt) / 1000))
  const steps = progress?.stage === "writing" ? progress.steps : 0
  const thought = progress?.stage === "thinking" ? progress.thought : undefined
  const [fixed, setFixed] = useState<{ problems: number; escalated: boolean } | null>(null)
  if (
    progress?.stage === "fixing" &&
    (fixed?.problems !== progress.problems || fixed.escalated !== progress.escalated)
  ) {
    setFixed({ problems: progress.problems, escalated: progress.escalated })
  }
  const visible = STAGES.filter(stage => stage.key !== "fixing" || fixed)

  return (
    <div className="space-y-3 rounded-xl border border-gray-800 bg-gray-950/60 p-4">
      <ol aria-label="Drafting progress" className="space-y-2 text-sm">
        {visible.map(stage => {
          const index = STAGES.indexOf(stage)
          const state = index < current ? "done" : index === current ? "active" : "waiting"
          return (
            <li
              key={stage.key}
              aria-current={state === "active" ? "step" : undefined}
              className={`flex items-center gap-3 ${
                state === "waiting" ? "text-gray-500" : "text-gray-200"
              }`}
            >
              <span
                aria-hidden
                className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                  state === "done"
                    ? "bg-green-700 text-white"
                    : state === "active"
                      ? "animate-pulse bg-orange-600 text-white"
                      : "border border-gray-700"
                }`}
              >
                {state === "done" ? "✓" : ""}
              </span>
              <span>
                {stage.key === "fixing" && fixed
                  ? fixingLabel(fixed.problems, fixed.escalated)
                  : stage.label}
                {stage.key === "writing" && state === "active" && steps > 0 && (
                  <span className="text-gray-400"> · {steps} so far</span>
                )}
                {stage.key === "thinking" && state === "active" && thought && (
                  <span className="block text-xs text-gray-400 italic">{thought}</span>
                )}
              </span>
            </li>
          )
        })}
      </ol>
      <p role="status" className="sr-only">
        {progress?.stage === "fixing"
          ? fixingLabel(progress.problems, progress.escalated)
          : (STAGES[current]?.label ?? STAGES[0].label)}
      </p>
      <p className="text-sm text-gray-400">
        {seconds} s. Usually 10–30 seconds; the AI plans the whole method before it starts writing.
      </p>
    </div>
  )
}
