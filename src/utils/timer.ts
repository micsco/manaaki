export interface TextSegment {
  type: "text"
  value: string
}

export interface TimerSegment {
  type: "timer"
  value: string
  seconds: number
}

export type StepSegment = TextSegment | TimerSegment

const DURATION_REGEX =
  /\b(?:(?<compoundHours>\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\s*(?:and\s+)?(?<compoundMinutes>\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m)|(?<hours>\d+(?:\.\d+)?)(?:\s*(?:-|–|to)\s*(?<hoursEnd>\d+(?:\.\d+)?))?\s*(?:hours?|hrs?)|(?<minutes>\d+(?:\.\d+)?)(?:\s*(?:-|–|to)\s*(?<minutesEnd>\d+(?:\.\d+)?))?\s*(?:minutes?|mins?)|(?<shortMinutes>\d+)\s*m|(?<seconds>\d+(?:\.\d+)?)(?:\s*(?:-|–|to)\s*(?<secondsEnd>\d+(?:\.\d+)?))?\s*(?:seconds?|secs?)|(?<shortSeconds>\d+)\s*s)\b/gi

export function parseDurationToSeconds(matchStr: string): number | null {
  const regex = new RegExp(DURATION_REGEX.source, "i")
  const match = regex.exec(matchStr)
  if (!match || !match.groups) {
    return null
  }

  const groups = match.groups

  if (groups.compoundHours && groups.compoundMinutes) {
    const hours = Number.parseFloat(groups.compoundHours)
    const minutes = Number.parseFloat(groups.compoundMinutes)
    return Math.round(hours * 3600 + minutes * 60)
  }

  if (groups.hours) {
    const hours = Number.parseFloat(groups.hours)
    return Math.round(hours * 3600)
  }

  if (groups.minutes) {
    const minutes = Number.parseFloat(groups.minutes)
    return Math.round(minutes * 60)
  }

  if (groups.shortMinutes) {
    const minutes = Number.parseFloat(groups.shortMinutes)
    return Math.round(minutes * 60)
  }

  if (groups.seconds) {
    const seconds = Number.parseFloat(groups.seconds)
    return Math.round(seconds)
  }

  if (groups.shortSeconds) {
    const seconds = Number.parseFloat(groups.shortSeconds)
    return Math.round(seconds)
  }

  return null
}

export function parseStepSegments(text: string): StepSegment[] {
  if (!text) {
    return []
  }

  const segments: StepSegment[] = []
  let lastIndex = 0

  const matches = Array.from(text.matchAll(DURATION_REGEX))

  for (const match of matches) {
    const matchIndex = match.index ?? 0
    const matchStr = match[0]
    const seconds = parseDurationToSeconds(matchStr)

    if (seconds === null || seconds <= 0) {
      continue
    }

    if (matchIndex > lastIndex) {
      segments.push({
        type: "text",
        value: text.slice(lastIndex, matchIndex),
      })
    }

    segments.push({
      type: "timer",
      value: matchStr,
      seconds,
    })

    lastIndex = matchIndex + matchStr.length
  }

  if (lastIndex < text.length) {
    segments.push({
      type: "text",
      value: text.slice(lastIndex),
    })
  }

  return segments
}

export function formatTimerDisplay(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(safeSeconds / 3600)
  const remainingMinutes = Math.floor((safeSeconds % 3600) / 60)
  const remainingSeconds = safeSeconds % 60

  const paddedMinutes = String(remainingMinutes).padStart(2, "0")
  const paddedSeconds = String(remainingSeconds).padStart(2, "0")

  if (hours > 0) {
    return `${hours}:${paddedMinutes}:${paddedSeconds}`
  }

  return `${paddedMinutes}:${paddedSeconds}`
}
