import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./performance",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  reporter: "list",
  use: {
    baseURL: process.env.PERF_BASE_URL ?? "http://127.0.0.1:4174",
    storageState: process.env.PERF_STORAGE_STATE,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: "block",
    trace: "off",
    video: "off",
  },
  webServer: process.env.PERF_BASE_URL
    ? undefined
    : {
        command: "PERFORMANCE_TEST=1 node scripts/pwa-test-server.mjs",
        url: "http://127.0.0.1:4174/manifest.webmanifest",
        reuseExistingServer: false,
      },
})
