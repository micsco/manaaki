export type DraftProgress =
  | { stage: "thinking"; thought?: string }
  | { stage: "writing"; steps: number }
  | { stage: "fixing"; problems: number; escalated: boolean }

const MAX_THOUGHT_CHARS = 140

export function summariseThought(text: string): string | null {
  const heading = [...text.matchAll(/\*\*(.+?)\*\*/g)].at(-1)?.[1]
  if (!heading && text.includes("**")) return null
  const line = (heading ?? text.split("\n").find(part => part.trim()) ?? "")
    .replace(/[*_`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
  if (!line) return null
  return line.length > MAX_THOUGHT_CHARS ? `${line.slice(0, MAX_THOUGHT_CHARS - 1)}…` : line
}

export function stepsWritten(partialJson: string): number {
  const opening = /"steps"\s*:\s*\[/.exec(partialJson)
  if (!opening) return 0
  let count = 0
  let depth = 0
  let inString = false
  let escaped = false
  for (const char of partialJson.slice(opening.index + opening[0].length)) {
    if (inString) {
      if (escaped) escaped = false
      else if (char === "\\") escaped = true
      else if (char === '"') {
        inString = false
        if (depth === 0) count++
      }
    } else if (char === '"') inString = true
    else if (char === "{" || char === "[") depth++
    else if (char === "}" || char === "]") {
      if (depth === 0) break
      depth--
      if (depth === 0 && char === "}") count++
    }
  }
  return count
}
