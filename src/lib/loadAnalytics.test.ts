import { expect, it, vi } from "vitest"

import { loadAnalytics } from "./loadAnalytics"

const init = vi.hoisted(() => vi.fn())
vi.mock("posthog-js", () => ({ default: { init } }))

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
      })
    )
  } finally {
    vi.unstubAllEnvs()
  }
})
