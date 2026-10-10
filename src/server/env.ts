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
