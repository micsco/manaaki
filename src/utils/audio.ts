let sharedAudioContext: AudioContext | null = null
let alarmIntervalId: ReturnType<typeof setInterval> | null = null
let alarmTimeoutId: ReturnType<typeof setTimeout> | null = null

export function isKitchenAlarmActive(): boolean {
  return alarmIntervalId !== null
}

export function resetAudioContextForTesting(): void {
  stopKitchenAlarm()
  sharedAudioContext = null
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null
  }

  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

  if (!AudioContextClass) {
    return null
  }

  if (!sharedAudioContext) {
    sharedAudioContext = new AudioContextClass()
  }

  return sharedAudioContext
}

function playTone(
  context: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  peakGain = 0.7
) {
  const osc = context.createOscillator()
  const gain = context.createGain()

  osc.type = "sine"
  osc.frequency.setValueAtTime(frequency, startTime)

  gain.gain.setValueAtTime(0.0001, startTime)
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)

  osc.connect(gain)
  gain.connect(context.destination)

  osc.start(startTime)
  osc.stop(startTime + duration)
}

export async function playKitchenChime(): Promise<boolean> {
  const context = getAudioContext()
  if (!context) {
    return false
  }

  try {
    if (context.state === "suspended") {
      await context.resume()
    }

    const now = context.currentTime

    playTone(context, 1760, now, 0.09, 0.7)
    playTone(context, 1760, now + 0.14, 0.09, 0.7)
    playTone(context, 2093, now + 0.28, 0.22, 0.75)

    return true
  } catch {
    return false
  }
}

export function startKitchenAlarm(maxDurationMs = 30000, onAutoStop?: () => void): void {
  if (alarmIntervalId !== null) {
    return
  }

  void playKitchenChime()

  alarmIntervalId = setInterval(() => {
    void playKitchenChime()
  }, 1600)

  alarmTimeoutId = setTimeout(() => {
    stopKitchenAlarm()
    onAutoStop?.()
  }, maxDurationMs)
}

export function stopKitchenAlarm(): void {
  if (alarmIntervalId !== null) {
    clearInterval(alarmIntervalId)
    alarmIntervalId = null
  }

  if (alarmTimeoutId !== null) {
    clearTimeout(alarmTimeoutId)
    alarmTimeoutId = null
  }
}
