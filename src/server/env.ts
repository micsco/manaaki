function required(name: string): string {
  const value = globalThis.process?.env?.[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export const mealieInternalUrl = (): string => required("MEALIE_INTERNAL_URL")
export const readonlyToken = (): string => required("MEALIE_READONLY_TOKEN")
export const sessionSecret = (): string => required("SESSION_SECRET")

function positiveInteger(name: string, fallback: number): number {
  const value = Number(globalThis.process?.env?.[name])
  return Number.isInteger(value) && value > 0 ? value : fallback
}

export const mealieReadTimeoutMs = (): number => positiveInteger("MEALIE_READ_TIMEOUT_MS", 15_000)
export const mealieWriteTimeoutMs = (): number =>
  positiveInteger("MEALIE_WRITE_TIMEOUT_MS", 120_000)
export const mealieConcurrencyLimit = (): number => positiveInteger("MEALIE_CONCURRENCY_LIMIT", 6)
export const mealieQueueTimeoutMs = (): number => positiveInteger("MEALIE_QUEUE_TIMEOUT_MS", 10_000)
export const mealieStalledSlotHoldMs = (): number =>
  positiveInteger("MEALIE_STALLED_SLOT_HOLD_MS", 30_000)

export const geminiApiKey = (): string | null => globalThis.process?.env?.GEMINI_API_KEY || null
export const geminiModel = (): string => globalThis.process?.env?.GEMINI_MODEL || "gemini-3.8-flash"

const THINKING_LEVELS = ["minimal", "low", "medium", "high"] as const
export type GeminiThinkingLevel = (typeof THINKING_LEVELS)[number]
export const geminiThinkingLevel = (): GeminiThinkingLevel | null => {
  const value = globalThis.process?.env?.GEMINI_THINKING_LEVEL?.trim().toLowerCase()
  return THINKING_LEVELS.find(level => level === value) ?? null
}
export const recipeVersionDraftsPerHour = (): number =>
  positiveInteger("RECIPE_VERSION_DRAFTS_PER_HOUR", 10)
