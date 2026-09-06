import type { AnyRouter } from "@tanstack/react-router"
import { useEffect, useRef } from "react"

import { toastManager } from "../lib/toastManager"
import { applyAppUpdate } from "../pwa/client"

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

export function useVersionCheck(_router: AnyRouter) {
  const updateDetectedAtRef = useRef<number | null>(null)
  const toastShownRef = useRef(false)
  const lastInteractionRef = useRef(0)

  useEffect(() => {
    lastInteractionRef.current = Date.now()
    const currentSha = import.meta.env.VITE_BUILD_GIT_SHORT_SHA as string | undefined
    const showUpdate = () => {
      if (toastShownRef.current) return
      toastShownRef.current = true
      toastManager.add({
        id: UPDATE_TOAST_ID,
        title: "Update available",
        description: "A new version is ready. Update when you’ve finished what you’re doing.",
        timeout: 0,
        priority: "low",
        actionProps: {
          children: "Update",
          onClick: () => {
            void applyAppUpdate()
          },
        },
      })
    }
    window.addEventListener("pwa-update-ready", showUpdate)

    const trackInteraction = () => {
      lastInteractionRef.current = Date.now()
    }
    window.addEventListener("pointerdown", trackInteraction, { passive: true })
    window.addEventListener("keydown", trackInteraction, { passive: true })

    const checkVersion = async () => {
      if (!currentSha) return
      const remoteSha = await fetchRemoteSha()
      if (!remoteSha || remoteSha === currentSha || remoteSha === "dev") return

      if (updateDetectedAtRef.current === null) {
        updateDetectedAtRef.current = Date.now()
      }

      const idleMs = Date.now() - lastInteractionRef.current
      if (idleMs >= IDLE_PROMPT_MS && !toastShownRef.current) {
        showUpdate()
      }
    }

    const intervalId = setInterval(checkVersion, POLL_INTERVAL_MS)

    return () => {
      window.removeEventListener("pwa-update-ready", showUpdate)
      clearInterval(intervalId)
      window.removeEventListener("pointerdown", trackInteraction)
      window.removeEventListener("keydown", trackInteraction)
    }
  }, [])
}
