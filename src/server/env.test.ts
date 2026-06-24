import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { mealieInternalUrl, readonlyToken, sessionSecret } from "./env"

const KEYS = ["MEALIE_INTERNAL_URL", "MEALIE_READONLY_TOKEN", "SESSION_SECRET"] as const
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
})
