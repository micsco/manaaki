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

export const claudeApiKey = (): string | null =>
  globalThis.process?.env?.CLAUDE_API_KEY || globalThis.process?.env?.ANTHROPIC_API_KEY || null

export const recipeVersionModel = (): string =>
  globalThis.process?.env?.RECIPE_VERSION_MODEL?.trim() || geminiModel()

const CLAUDE_EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const
export type ClaudeEffort = (typeof CLAUDE_EFFORTS)[number]
export const claudeEffort = (): ClaudeEffort | null => {
  const value = globalThis.process?.env?.CLAUDE_EFFORT?.trim().toLowerCase()
  return CLAUDE_EFFORTS.find(effort => effort === value) ?? null
}

export const recipeEscalationModel = (): string | null => {
  const value = globalThis.process?.env?.RECIPE_ESCALATION_MODEL?.trim()
  if (value === undefined || value === "") return "claude-sonnet-5-5"
  return value.toLowerCase() === "none" ? null : value
}

export const PROMPT_VERSION_NAMES = ["v1", "v2", "v3"] as const
export type PromptVersionName = (typeof PROMPT_VERSION_NAMES)[number]
export const isPromptVersionName = (value: string): value is PromptVersionName =>
  PROMPT_VERSION_NAMES.some(name => name === value)

export const DEFAULT_PROMPT_VERSION: PromptVersionName = "v2"

export const recipePromptVersion = (): PromptVersionName => {
  const value = globalThis.process?.env?.RECIPE_PROMPT_VERSION?.trim().toLowerCase() ?? ""
  return isPromptVersionName(value) ? value : DEFAULT_PROMPT_VERSION
}

const THINKING_LEVELS = ["low", "medium", "high"] as const
export type GeminiThinkingLevel = (typeof THINKING_LEVELS)[number]
export const geminiThinkingLevel = (): GeminiThinkingLevel | null => {
  const value = globalThis.process?.env?.GEMINI_THINKING_LEVEL?.trim().toLowerCase()
  return THINKING_LEVELS.find(level => level === value) ?? null
}
export const recipeVersionDraftsPerHour = (): number =>
  positiveInteger("RECIPE_VERSION_DRAFTS_PER_HOUR", 10)

export const posthogProjectToken = (): string | null =>
  globalThis.process?.env?.POSTHOG_PROJECT_TOKEN ||
  import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN ||
  null
export const posthogIngestionHost = (): string =>
  globalThis.process?.env?.POSTHOG_INGESTION_HOST || "https://eu.i.posthog.com"
