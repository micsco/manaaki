import type { AnyRouter, BlockerFn } from "@tanstack/react-router"
import { useEffect } from "react"

import type { AnalyticsClient } from "../lib/analytics"
import { toastManager } from "../lib/toastManager"
import {
  applyAppUpdate,
  currentBuildSha,
  isApplyingAppUpdate,
  markUpdatePending,
  onUpdatePending,
  recentlyAttemptedUpdate,
  takeAppliedUpdate,
  updatePendingSince,
  type UpdateTrigger,
} from "../pwa/appUpdate"
import { noteTyping, updateBlockers, type UpdateContext } from "../pwa/updateHolds"

export const VERSION_POLL_MS = 5 * 60 * 1000
export const FRESH_START_MS = 10 * 1000
export const HIDDEN_APPLY_MS = 60 * 1000
export const RESUME_APPLY_MS = 5 * 60 * 1000
export const IDLE_APPLY_MS = 10 * 60 * 1000
export const IDLE_CHECK_MS = 30 * 1000
export const FALLBACK_PROMPT_MS = 12 * 60 * 60 * 1000
const UPDATE_TOAST_ID = "app-update-available"
const INTERACTION_EVENTS = ["pointerdown", "keydown", "wheel", "touchmove"] as const

async function fetchRemoteSha(): Promise<string | null> {
  try {
    const res = await fetch("/version.json", { cache: "no-store" })
    if (!res.ok) return null
    const data = (await res.json()) as { sha?: string }
    return data.sha ?? null
  } catch {
    return null
  }
}

function canApplyUpdate(context: UpdateContext) {
  return (
    updatePendingSince() !== null &&
    !isApplyingAppUpdate() &&
    !recentlyAttemptedUpdate() &&
    updateBlockers(context).length === 0
  )
}

function tryApplyUpdate(trigger: UpdateTrigger, context: UpdateContext = "in-place") {
  if (!canApplyUpdate(context)) return false
  void applyAppUpdate(trigger)
  return true
}

export function useAutoUpdate(router: AnyRouter, analytics: AnalyticsClient) {
  useEffect(() => {
    const applied = takeAppliedUpdate()
    if (applied)
      analytics.capture("app_updated", {
        trigger: applied.trigger,
        source: applied.source,
        held_ms: applied.heldMs,
        from_sha: applied.fromSha,
        to_sha: applied.toSha,
      })
  }, [analytics])

  useEffect(() => {
    let freshSince = Date.now()
    let freshTrigger: UpdateTrigger = "launch"
    let lastInteractionAt = 0
    let hiddenAt: number | null = document.visibilityState === "hidden" ? Date.now() : null
    let hiddenTimer: number | undefined
    let reloadAfterNavigation = false
    let promptShown = false

    const untouchedSinceFreshStart = () =>
      lastInteractionAt < freshSince && Date.now() - freshSince < FRESH_START_MS

    const scheduleHiddenApply = () => {
      window.clearTimeout(hiddenTimer)
      if (updatePendingSince() === null) return
      hiddenTimer = window.setTimeout(() => {
        if (document.visibilityState === "hidden") tryApplyUpdate("hidden")
      }, HIDDEN_APPLY_MS)
    }

    const onPending = () => {
      if (document.visibilityState === "hidden") {
        scheduleHiddenApply()
        return
      }
      if (untouchedSinceFreshStart()) tryApplyUpdate(freshTrigger)
    }

    const onVisibility = () => {
      const now = Date.now()
      if (document.visibilityState === "hidden") {
        hiddenAt = now
        scheduleHiddenApply()
        return
      }
      window.clearTimeout(hiddenTimer)
      const away = hiddenAt === null ? 0 : now - hiddenAt
      hiddenAt = null
      if (away < RESUME_APPLY_MS) return
      freshSince = now
      freshTrigger = "resume"
      tryApplyUpdate("resume")
    }

    const trackInteraction = () => {
      lastInteractionAt = Date.now()
    }

    const showFallbackPrompt = () => {
      promptShown = true
      toastManager.add({
        id: UPDATE_TOAST_ID,
        title: "Update ready",
        description: "Manaaki will finish updating when you tap Update.",
        timeout: 0,
        priority: "low",
        actionProps: {
          children: "Update",
          onClick: () => {
            toastManager.update(UPDATE_TOAST_ID, {
              title: "Updating app…",
              description: "The app will reload when the update is ready.",
              actionProps: { children: "Updating…", disabled: true, "aria-busy": true },
            })
            void applyAppUpdate("manual")
          },
        },
      })
    }

    const idleCheck = () => {
      const pendingSince = updatePendingSince()
      if (pendingSince === null || document.visibilityState !== "visible") return
      const lastActivity = Math.max(lastInteractionAt, freshSince)
      if (Date.now() - lastActivity >= IDLE_APPLY_MS && tryApplyUpdate("idle")) return
      if (!promptShown && Date.now() - pendingSince >= FALLBACK_PROMPT_MS) showFallbackPrompt()
    }

    const currentSha = currentBuildSha()
    const versionCheck = async () => {
      if (!currentSha || document.visibilityState !== "visible") return
      const remoteSha = await fetchRemoteSha()
      if (!remoteSha || remoteSha === currentSha || remoteSha === "dev") return
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        const registration = await navigator.serviceWorker.getRegistration()
        await registration?.update().catch(() => {})
        return
      }
      markUpdatePending("version-file")
    }

    const onPreloadError = (event: Event) => {
      if (recentlyAttemptedUpdate()) return
      event.preventDefault()
      void applyAppUpdate("chunk-error")
    }

    const blockerFn: BlockerFn = ({ currentLocation, nextLocation, action }) => {
      if (currentLocation.pathname === nextLocation.pathname) return false
      if (!canApplyUpdate("navigation")) return false
      if (action === "PUSH" || action === "REPLACE") {
        void applyAppUpdate("navigation", {
          href: nextLocation.href,
          replace: action === "REPLACE",
        })
        return true
      }
      reloadAfterNavigation = true
      return false
    }
    const unblock = router.history.block({ blockerFn, enableBeforeUnload: false })
    const unsubscribe = router.subscribe("onResolved", () => {
      if (!reloadAfterNavigation) return
      reloadAfterNavigation = false
      tryApplyUpdate("navigation", "navigation")
    })

    const stopPending = onUpdatePending(onPending)
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("vite:preloadError", onPreloadError)
    document.addEventListener("input", noteTyping, true)
    for (const type of INTERACTION_EVENTS)
      window.addEventListener(type, trackInteraction, { passive: true, capture: true })
    const idleInterval = window.setInterval(idleCheck, IDLE_CHECK_MS)
    const versionInterval = window.setInterval(() => void versionCheck(), VERSION_POLL_MS)
    if (updatePendingSince() !== null) onPending()

    return () => {
      unblock()
      unsubscribe()
      stopPending()
      window.clearTimeout(hiddenTimer)
      window.clearInterval(idleInterval)
      window.clearInterval(versionInterval)
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("vite:preloadError", onPreloadError)
      document.removeEventListener("input", noteTyping, true)
      for (const type of INTERACTION_EVENTS)
        window.removeEventListener(type, trackInteraction, { capture: true })
    }
  }, [router])
}
