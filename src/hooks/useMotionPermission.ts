import { useHydrated } from "@tanstack/react-router"
import { useCallback, useEffect, useState } from "react"

export type MotionPermissionState = "unavailable" | "prompt" | "granted" | "denied"

type IOSDeviceMotionEvent = typeof DeviceMotionEvent & {
  requestPermission: () => Promise<"granted" | "denied">
}

const GRANTED_STORAGE_KEY = "manaaki:motion-granted"
const REQUEST_GESTURES = ["click", "touchend"] as const

function needsPermissionRequest(): boolean {
  return (
    typeof (DeviceMotionEvent as unknown as IOSDeviceMotionEvent).requestPermission === "function"
  )
}

function detectInitialState(): MotionPermissionState {
  if (typeof window === "undefined") return "unavailable"
  if (!window.DeviceMotionEvent) return "unavailable"
  if (needsPermissionRequest()) return "prompt"
  return "granted"
}

function wasPreviouslyGranted(): boolean {
  try {
    return window.localStorage.getItem(GRANTED_STORAGE_KEY) === "true"
  } catch {
    return false
  }
}

function rememberGrant(granted: boolean) {
  try {
    if (granted) window.localStorage.setItem(GRANTED_STORAGE_KEY, "true")
    else window.localStorage.removeItem(GRANTED_STORAGE_KEY)
  } catch {
    return
  }
}

export function useMotionPermission() {
  const hydrated = useHydrated()
  const [permission, setState] = useState<MotionPermissionState | null>(null)
  const state = permission ?? (hydrated ? detectInitialState() : "unavailable")

  const request = useCallback(async () => {
    if (!needsPermissionRequest()) {
      setState("granted")
      return
    }
    try {
      const result = await (
        DeviceMotionEvent as unknown as IOSDeviceMotionEvent
      ).requestPermission()
      rememberGrant(result === "granted")
      setState(result === "granted" ? "granted" : "denied")
    } catch {
      setState("denied")
    }
  }, [])

  useEffect(() => {
    if (state !== "prompt" || !wasPreviouslyGranted()) return
    const requestOnGesture = () => {
      stopListening()
      void request()
    }
    function stopListening() {
      for (const gesture of REQUEST_GESTURES) {
        window.removeEventListener(gesture, requestOnGesture, { capture: true })
      }
    }
    for (const gesture of REQUEST_GESTURES) {
      window.addEventListener(gesture, requestOnGesture, { capture: true, once: true })
    }
    return stopListening
  }, [state, request])

  return { state, request }
}
