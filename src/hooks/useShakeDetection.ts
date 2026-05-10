import { useEffect, useRef } from "react"

const SHAKE_THRESHOLD = 15
const REQUIRED_PEAKS = 3
const PEAK_WINDOW_MS = 600
const COOLDOWN_MS = 1500

interface UseShakeDetectionOptions {
  onShake: () => void
  enabled?: boolean
}

function magnitude(acc: DeviceMotionEventAcceleration): number {
  return Math.sqrt((acc.x ?? 0) ** 2 + (acc.y ?? 0) ** 2 + (acc.z ?? 0) ** 2)
}

export function useShakeDetection({ onShake, enabled = true }: UseShakeDetectionOptions): void {
  const peakTimestampsRef = useRef<number[]>([])
  const lastShakeRef = useRef<number>(0)
  const onShakeRef = useRef(onShake)
  onShakeRef.current = onShake

  useEffect(() => {
    if (!enabled) return
    if (typeof window === "undefined") return
    if (!window.DeviceMotionEvent) return

    function recordPeak(now: number): boolean {
      if (now - lastShakeRef.current < COOLDOWN_MS) return false
      peakTimestampsRef.current.push(now)
      peakTimestampsRef.current = peakTimestampsRef.current.filter(t => t >= now - PEAK_WINDOW_MS)
      return peakTimestampsRef.current.length >= REQUIRED_PEAKS
    }

    function handleMotion(event: DeviceMotionEvent) {
      const acc = event.accelerationIncludingGravity
      if (!acc || magnitude(acc) <= SHAKE_THRESHOLD) return

      const now = Date.now()
      if (!recordPeak(now)) return

      peakTimestampsRef.current = []
      lastShakeRef.current = now
      onShakeRef.current()
    }

    window.addEventListener("devicemotion", handleMotion)
    return () => window.removeEventListener("devicemotion", handleMotion)
  }, [enabled])
}
