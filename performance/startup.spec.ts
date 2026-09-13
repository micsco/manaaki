import process from "node:process"

import { expect, test } from "@playwright/test"

const recipePath = process.env.PERF_RECIPE_PATH ?? "/recipes/AAAAAAAAQACAAAAAAAAAAQ/pasta-carbonara"
const routes = [
  { name: "plan", path: "/plan" },
  { name: "recipes", path: "/recipes" },
  { name: "recipe", path: recipePath },
]

for (const route of routes) {
  test(`${route.name}: cold and warm mobile startup`, async ({ browser, baseURL }, testInfo) => {
    test.skip(
      !!process.env.PERF_BASE_URL && route.name === "recipe" && !process.env.PERF_RECIPE_PATH
    )
    const samples = []
    for (let run = 1; run <= 3; run++) {
      const context = await browser.newContext({
        ...testInfo.project.use,
        baseURL,
      })
      const page = await context.newPage()
      const session = await context.newCDPSession(page)
      await session.send("Network.enable")
      await session.send("Network.setBypassServiceWorker", { bypass: true })
      await session.send("Emulation.setCPUThrottlingRate", { rate: 4 })
      await session.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 150,
        downloadThroughput: 200_000,
        uploadThroughput: 93_750,
      })
      await page.addInitScript(() => {
        const metrics = { lcp: 0, longTaskMs: 0 }
        Object.assign(window, { startupMetrics: metrics })
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) metrics.lcp = entry.startTime
        }).observe({ type: "largest-contentful-paint", buffered: true })
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) metrics.longTaskMs += entry.duration
        }).observe({ type: "longtask", buffered: true })
      })
      for (const cache of ["cold", "warm"] as const) {
        await session.send("Network.setCacheDisabled", { cacheDisabled: cache === "cold" })
        await page.goto(route.path, { waitUntil: "load" })
        if (route.name === "recipe") {
          await expect(page.getByRole("button", { name: "Cook", exact: true })).toBeVisible()
        } else {
          await expect(page.locator('main a[href^="/recipes/"]').first()).toBeVisible()
        }
        const usableMs = await page.evaluate(() => performance.now())
        await page.waitForFunction(() =>
          [...document.images].every(image => {
            const bounds = image.getBoundingClientRect()
            return bounds.top >= innerHeight || bounds.bottom <= 0 || image.complete
          })
        )
        await page.waitForTimeout(1000)
        const metrics = await page.evaluate(() => {
          const navigation = performance.getEntriesByType(
            "navigation"
          )[0] as PerformanceNavigationTiming
          const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[]
          const assets = resources.filter(entry =>
            new URL(entry.name).pathname.startsWith("/assets/")
          )
          return {
            ...(window as unknown as { startupMetrics: { lcp: number; longTaskMs: number } })
              .startupMetrics,
            ttfb: navigation.responseStart - navigation.startTime,
            fcp: performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0,
            assetBytes: assets.reduce((sum, entry) => sum + entry.transferSize, 0),
            jsBytes: assets
              .filter(entry => new URL(entry.name).pathname.endsWith(".js"))
              .reduce((sum, entry) => sum + entry.transferSize, 0),
            fontBytes: assets
              .filter(entry => new URL(entry.name).pathname.endsWith(".woff2"))
              .reduce((sum, entry) => sum + entry.transferSize, 0),
            api: resources
              .filter(entry => new URL(entry.name).pathname.startsWith("/api/"))
              .map(entry => ({
                endpoint: new URL(entry.name).pathname.split("/").slice(0, 3).join("/"),
                start: entry.startTime,
                duration: entry.duration,
                serverTiming: entry.serverTiming.map(({ name, duration }) => ({ name, duration })),
              })),
            serverTiming: navigation.serverTiming.map(({ name, duration }) => ({ name, duration })),
          }
        })
        expect(metrics.fcp).toBeGreaterThan(0)
        expect(metrics.lcp).toBeGreaterThan(0)
        samples.push({ route: route.name, run, cache, usableMs, ...metrics })
      }
      await context.close()
    }
    await testInfo.attach(`${route.name}-startup.json`, {
      body: JSON.stringify(
        { source: process.env.PERF_BASE_URL ? "live" : "fixture", samples },
        null,
        2
      ),
      contentType: "application/json",
    })
    console.table(
      samples.map(({ route: name, run, cache, ttfb, fcp, lcp, jsBytes, fontBytes }) => ({
        route: name,
        run,
        cache,
        ttfb: Math.round(ttfb),
        fcp: Math.round(fcp),
        lcp: Math.round(lcp),
        jsBytes,
        fontBytes,
      }))
    )
  })
}
