import { useEffect, useRef } from "react"

const THRESHOLD = 13
const JERK_COUNT = 3
const WINDOW_MS = 500
const DEBOUNCE_MS = 1000

interface UseShakeDetectionOptions {
  onShake: () => void
  enabled?: boolean
}

function dominantAxis(x: number, y: number, z: number): { axis: "x" | "y" | "z"; sign: number } {
  const ax = Math.abs(x)
  const ay = Math.abs(y)
  const az = Math.abs(z)
  if (ax >= ay && ax >= az) return { axis: "x", sign: Math.sign(x) }
  if (ay >= az) return { axis: "y", sign: Math.sign(y) }
  return { axis: "z", sign: Math.sign(z) }
}

function pickAcceleration(event: DeviceMotionEvent): DeviceMotionEventAcceleration | null {
  const raw = event.acceleration
  if (raw?.x != null && raw?.y != null && raw?.z != null) return raw
  return event.accelerationIncludingGravity
}

interface ShakeState {
  jerks: number[]
  lastAxis: "x" | "y" | "z" | null
  lastSign: number
  lastFire: number
}

function processJerk(state: ShakeState, now: number, axis: "x" | "y" | "z", sign: number): boolean {
  const isReversal = axis !== state.lastAxis || sign !== state.lastSign
  state.lastAxis = axis
  state.lastSign = sign
  if (!isReversal) return false

  state.jerks.push(now)
  state.jerks = state.jerks.filter(t => now - t <= WINDOW_MS)
  if (state.jerks.length < JERK_COUNT) return false

  state.jerks = []
  state.lastAxis = null
  state.lastSign = 0
  state.lastFire = now
  return true
}

export function useShakeDetection({ onShake, enabled = true }: UseShakeDetectionOptions): void {
  const stateRef = useRef<ShakeState>({ jerks: [], lastAxis: null, lastSign: 0, lastFire: 0 })
  const onShakeRef = useRef(onShake)
  onShakeRef.current = onShake

  useEffect(() => {
    if (!enabled) return
    if (typeof window === "undefined") return
    if (!window.DeviceMotionEvent) return

    function handleMotion(event: DeviceMotionEvent) {
      const now = Date.now()
      const state = stateRef.current
      if (now - state.lastFire < DEBOUNCE_MS) return

      const accel = pickAcceleration(event)
      if (!accel) return

      const x = accel.x ?? 0
      const y = accel.y ?? 0
      const z = accel.z ?? 0
      if (Math.sqrt(x * x + y * y + z * z) < THRESHOLD) return

      const { axis, sign } = dominantAxis(x, y, z)
      if (processJerk(state, now, axis, sign)) onShakeRef.current()
    }

    window.addEventListener("devicemotion", handleMotion)
    return () => window.removeEventListener("devicemotion", handleMotion)
  }, [enabled])
}
