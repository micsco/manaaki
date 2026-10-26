import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  geminiApiKey,
  geminiModel,
  mealieInternalUrl,
  readonlyToken,
  recipeVersionDraftsPerHour,
  sessionSecret,
} from "./env"

const KEYS = [
  "MEALIE_INTERNAL_URL",
  "MEALIE_READONLY_TOKEN",
  "SESSION_SECRET",
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
  "RECIPE_VERSION_DRAFTS_PER_HOUR",
] as const
let saved: Record<string, string | undefined>

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map(k => [k, process.env[k]]))
})
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

describe("server env", () => {
  it("returns the configured values", () => {
    process.env.MEALIE_INTERNAL_URL = "http://mealie:9000"
    process.env.MEALIE_READONLY_TOKEN = "ro-token"
    process.env.SESSION_SECRET = "secret"
    expect(mealieInternalUrl()).toBe("http://mealie:9000")
    expect(readonlyToken()).toBe("ro-token")
    expect(sessionSecret()).toBe("secret")
  })

  it("throws when a required var is missing", () => {
    process.env.SESSION_SECRET = ""
    expect(() => sessionSecret()).toThrow(/SESSION_SECRET/)
  })

  it("reads the optional AI settings with safe defaults", () => {
    delete process.env.GEMINI_API_KEY
    delete process.env.GEMINI_MODEL
    delete process.env.RECIPE_VERSION_DRAFTS_PER_HOUR
    expect(geminiApiKey()).toBeNull()
    expect(geminiModel()).toBe("gemini-3.8-flash")
    expect(recipeVersionDraftsPerHour()).toBe(10)
    process.env.GEMINI_API_KEY = "key"
    process.env.GEMINI_MODEL = "gemini-other"
    process.env.RECIPE_VERSION_DRAFTS_PER_HOUR = "3"
    expect(geminiApiKey()).toBe("key")
    expect(geminiModel()).toBe("gemini-other")
    expect(recipeVersionDraftsPerHour()).toBe(3)
  })
})
