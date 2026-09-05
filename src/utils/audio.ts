let sharedAudioContext: AudioContext | null = null

export function resetAudioContextForTesting(): void {
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

function playTone(context: AudioContext, frequency: number, startTime: number, duration: number) {
  const osc = context.createOscillator()
  const gain = context.createGain()

  osc.type = "sine"
  osc.frequency.setValueAtTime(frequency, startTime)

  gain.gain.setValueAtTime(0.0001, startTime)
  gain.gain.linearRampToValueAtTime(0.3, startTime + 0.02)
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

    playTone(context, 880, now, 0.25)
    playTone(context, 1320, now + 0.18, 0.45)

    playTone(context, 880, now + 0.5, 0.25)
    playTone(context, 1320, now + 0.68, 0.6)

    return true
  } catch {
    return false
  }
}
