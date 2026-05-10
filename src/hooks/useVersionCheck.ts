import type { AnyRouter } from "@tanstack/react-router"
import { useEffect, useRef } from "react"
import { toastManager } from "../lib/toastManager"

const POLL_INTERVAL_MS = 5 * 60 * 1000
const IDLE_PROMPT_MS = 15 * 60 * 1000
const UPDATE_TOAST_ID = "app-update-available"

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

export function useVersionCheck(router: AnyRouter) {
  const updateDetectedAtRef = useRef<number | null>(null)
  const toastShownRef = useRef(false)
  const lastInteractionRef = useRef(Date.now())

  useEffect(() => {
    const currentSha = import.meta.env.VITE_BUILD_GIT_SHORT_SHA as string | undefined
    if (!currentSha) return

    const trackInteraction = () => {
      lastInteractionRef.current = Date.now()
    }
    window.addEventListener("pointermove", trackInteraction, { passive: true })
    window.addEventListener("keydown", trackInteraction, { passive: true })

    const checkVersion = async () => {
      const remoteSha = await fetchRemoteSha()
      if (!remoteSha || remoteSha === currentSha || remoteSha === "dev") return

      if (updateDetectedAtRef.current === null) {
        updateDetectedAtRef.current = Date.now()
      }

      const idleMs = Date.now() - lastInteractionRef.current
      if (idleMs >= IDLE_PROMPT_MS && !toastShownRef.current) {
        toastShownRef.current = true
        toastManager.add({
          id: UPDATE_TOAST_ID,
          title: "Update available",
          description: "A new version of Manaaki is ready.",
          timeout: 0,
          priority: "low",
          actionProps: {
            children: "Reload",
            onClick: () => window.location.reload(),
          },
        })
      }
    }

    const intervalId = setInterval(checkVersion, POLL_INTERVAL_MS)

    const unsubscribe = router.subscribe("onResolved", () => {
      if (updateDetectedAtRef.current !== null) {
        window.location.reload()
      }
    })

    return () => {
      clearInterval(intervalId)
      unsubscribe()
      window.removeEventListener("pointermove", trackInteraction)
      window.removeEventListener("keydown", trackInteraction)
    }
  }, [router])
}
