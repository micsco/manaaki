import { useEffect, useRef } from "react"

const SHAKE_THRESHOLD = 15
const COOLDOWN_MS = 1000

interface UseShakeDetectionOptions {
  onShake: () => void
  enabled?: boolean
}

export function useShakeDetection({ onShake, enabled = true }: UseShakeDetectionOptions): void {
  const lastShakeRef = useRef<number>(0)
  const onShakeRef = useRef(onShake)
  onShakeRef.current = onShake

  useEffect(() => {
    if (!enabled) return
    if (typeof window === "undefined") return
    if (!window.DeviceMotionEvent) return

    function handleMotion(event: DeviceMotionEvent) {
      const acc = event.accelerationIncludingGravity
      if (!acc) return

      const magnitude = Math.sqrt((acc.x ?? 0) ** 2 + (acc.y ?? 0) ** 2 + (acc.z ?? 0) ** 2)

      if (magnitude > SHAKE_THRESHOLD) {
        const now = Date.now()
        if (now - lastShakeRef.current > COOLDOWN_MS) {
          lastShakeRef.current = now
          onShakeRef.current()
        }
      }
    }

    window.addEventListener("devicemotion", handleMotion)
    return () => window.removeEventListener("devicemotion", handleMotion)
  }, [enabled])
}
