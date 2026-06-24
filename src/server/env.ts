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
