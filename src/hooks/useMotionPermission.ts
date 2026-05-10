import { useCallback, useEffect, useState } from "react"

export type MotionPermissionState = "unavailable" | "prompt" | "granted" | "denied"

type IOSDeviceMotionEvent = typeof DeviceMotionEvent & {
  requestPermission: () => Promise<"granted" | "denied">
}

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

export function useMotionPermission() {
  const [state, setState] = useState<MotionPermissionState>(detectInitialState)

  useEffect(() => {
    setState(detectInitialState())
  }, [])

  const request = useCallback(async () => {
    if (!needsPermissionRequest()) {
      setState("granted")
      return
    }
    try {
      const result = await (
        DeviceMotionEvent as unknown as IOSDeviceMotionEvent
      ).requestPermission()
      setState(result === "granted" ? "granted" : "denied")
    } catch {
      setState("denied")
    }
  }, [])

  return { state, request }
}
