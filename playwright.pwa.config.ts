import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e/pwa",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:4174", trace: "retain-on-failure" },
  projects: [
    { name: "android-pwa", use: { ...devices["Pixel 7"] } },
    { name: "iphone-pwa", use: { ...devices["iPhone 13"] } },
  ],
  webServer: {
    command: "node scripts/pwa-test-server.mjs",
    url: "http://127.0.0.1:4174/manifest.webmanifest",
    reuseExistingServer: false,
  },
})
