import { expect, it, vi } from "vitest"

import { loadAnalytics } from "./loadAnalytics"

const init = vi.hoisted(() => vi.fn())
const register = vi.hoisted(() => vi.fn())
vi.mock("posthog-js", () => ({ default: { init, register } }))

it("keeps the analytics configuration while delegating pageviews to the router", async () => {
  vi.stubEnv("VITE_PUBLIC_POSTHOG_PROJECT_TOKEN", "fixture")
  try {
    await loadAnalytics()
    expect(init).toHaveBeenCalledWith(
      "fixture",
      expect.objectContaining({
        api_host: "/ingest",
        capture_exceptions: true,
        capture_pageview: false,
        tracing_headers: [window.location.hostname],
      })
    )
  } finally {
    vi.unstubAllEnvs()
  }
})

it("tags every event and browser metric with the running build", async () => {
  vi.stubEnv("VITE_PUBLIC_POSTHOG_PROJECT_TOKEN", "fixture")
  vi.stubEnv("VITE_BUILD_GIT_SHORT_SHA", "abc1234")
  try {
    await loadAnalytics()
    expect(init).toHaveBeenLastCalledWith(
      "fixture",
      expect.objectContaining({
        metrics: { serviceName: "manaaki-web", serviceVersion: "abc1234", environment: "test" },
      })
    )
    expect(register).toHaveBeenCalledWith({ app_version: "abc1234" })
  } finally {
    vi.unstubAllEnvs()
  }
})
