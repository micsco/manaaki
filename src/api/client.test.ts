import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

describe("configureApiClient", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it("sets no Authorization header in the browser", async () => {
    vi.resetModules()
    const { client } = await import("./generated/client.gen")
    const setConfig = vi.spyOn(client, "setConfig")
    const { configureApiClient } = await import("./client")
    configureApiClient()
    const cfg = setConfig.mock.calls[0][0] as { headers?: unknown; baseUrl?: string }
    expect(cfg.headers).toBeUndefined()
    expect(cfg.baseUrl).toBe("")
    setConfig.mockRestore()
  })

  it("configures base URL as empty string on client side", async () => {
    vi.stubGlobal("window", {})
    const { client, configureApiClient } = await import("./client")

    configureApiClient()

    const config = client.getConfig()
    expect(config.baseUrl).toBe("")
    const headers = config.headers as Headers
    expect(headers.get("Authorization")).toBeNull()
  })

  it("configures base URL and auth header on server side when env is set", async () => {
    vi.stubGlobal("window", undefined)
    vi.stubEnv("MEALIE_INTERNAL_URL", "http://mealie-internal:9000")
    vi.stubEnv("MEALIE_READONLY_TOKEN", "test-token")

    const { client, configureApiClient } = await import("./client")

    configureApiClient()

    const config = client.getConfig()
    expect(config.baseUrl).toBe("http://mealie-internal:9000")
    const headers = config.headers as Headers
    expect(headers.get("Authorization")).toBe("Bearer test-token")
  })

  it("configures default base URL on server side when env is empty", async () => {
    vi.stubGlobal("window", undefined)
    vi.stubEnv("MEALIE_INTERNAL_URL", undefined)
    vi.stubEnv("MEALIE_READONLY_TOKEN", undefined)

    const { client, configureApiClient } = await import("./client")

    configureApiClient()

    const config = client.getConfig()
    expect(config.baseUrl).toBe("")
    const headers = config.headers as Headers
    expect(headers.get("Authorization")).toBeNull()
  })
})
