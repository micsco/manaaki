import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  geminiApiKey,
  geminiModel,
  geminiThinkingLevel,
  claudeApiKey,
  claudeEffort,
  recipeEscalationModel,
  recipeVersionModel,
  mealieInternalUrl,
  posthogIngestionHost,
  posthogProjectToken,
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
  "GEMINI_THINKING_LEVEL",
  "CLAUDE_API_KEY",
  "ANTHROPIC_API_KEY",
  "CLAUDE_EFFORT",
  "RECIPE_VERSION_MODEL",
  "RECIPE_ESCALATION_MODEL",
  "RECIPE_VERSION_DRAFTS_PER_HOUR",
  "POSTHOG_PROJECT_TOKEN",
  "POSTHOG_INGESTION_HOST",
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
    expect(geminiThinkingLevel()).toBeNull()
    process.env.GEMINI_THINKING_LEVEL = " LOW "
    expect(geminiThinkingLevel()).toBe("low")
    process.env.GEMINI_THINKING_LEVEL = "max"
    expect(geminiThinkingLevel()).toBeNull()
  })

  it("reads the PostHog token at runtime, falling back to the one built into the app", () => {
    vi.stubEnv("VITE_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_build")
    try {
      delete process.env.POSTHOG_PROJECT_TOKEN
      expect(posthogProjectToken()).toBe("phc_build")
      process.env.POSTHOG_PROJECT_TOKEN = "phc_runtime"
      expect(posthogProjectToken()).toBe("phc_runtime")
      vi.stubEnv("VITE_PUBLIC_POSTHOG_PROJECT_TOKEN", "")
      delete process.env.POSTHOG_PROJECT_TOKEN
      expect(posthogProjectToken()).toBeNull()
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it("sends server telemetry to PostHog EU unless told otherwise", () => {
    delete process.env.POSTHOG_INGESTION_HOST
    expect(posthogIngestionHost()).toBe("https://eu.i.posthog.com")
    process.env.POSTHOG_INGESTION_HOST = "https://us.i.posthog.com"
    expect(posthogIngestionHost()).toBe("https://us.i.posthog.com")
  })

  it("reads the drafting model and Claude settings", () => {
    for (const key of [
      "CLAUDE_API_KEY",
      "ANTHROPIC_API_KEY",
      "CLAUDE_EFFORT",
      "RECIPE_VERSION_MODEL",
      "GEMINI_MODEL",
    ])
      delete process.env[key]
    expect(recipeVersionModel()).toBe("gemini-3.8-flash")
    expect(claudeApiKey()).toBeNull()
    expect(claudeEffort()).toBeNull()
    process.env.RECIPE_VERSION_MODEL = " claude-sonnet-5-5 "
    process.env.ANTHROPIC_API_KEY = "fallback"
    process.env.CLAUDE_EFFORT = "HIGH"
    expect(recipeVersionModel()).toBe("claude-sonnet-5-5")
    expect(claudeApiKey()).toBe("fallback")
    process.env.CLAUDE_API_KEY = "preferred"
    expect(claudeApiKey()).toBe("preferred")
    expect(claudeEffort()).toBe("high")
    process.env.CLAUDE_EFFORT = "turbo"
    expect(claudeEffort()).toBeNull()
  })

  it("escalates to Sonnet unless another model or none is set", () => {
    delete process.env.RECIPE_ESCALATION_MODEL
    expect(recipeEscalationModel()).toBe("claude-sonnet-5-5")
    process.env.RECIPE_ESCALATION_MODEL = "claude-opus-5-5"
    expect(recipeEscalationModel()).toBe("claude-opus-5-5")
    process.env.RECIPE_ESCALATION_MODEL = "None"
    expect(recipeEscalationModel()).toBeNull()
  })
})
