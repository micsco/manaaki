# Startup performance

Build once, then run `pnpm test:performance`. For comparable fixture builds, use these fixed public settings:

```sh
VITE_PUBLIC_POSTHOG_PROJECT_TOKEN=performance-fixture \
VITE_PUBLIC_POSTHOG_HOST=https://eu.posthog.com \
VITE_PUBLIC_MEALIE_BASE_URL=https://mealie.example \
VITE_BUILD_GIT_SHORT_SHA=performance pnpm build
pnpm test:performance
```

The benchmark uses the production browser bundle with a local fixture API, a fixed cached forecast and compressed, cacheable assets. Analytics requests receive empty local fixture responses. It runs three fresh-browser cold/warm pairs for the plan, recipe list and recipe detail, sequentially. Each run uses a 390 × 844 viewport, 4× CPU slowdown, 150 ms simulated latency, 1.6 Mbps download and 0.75 Mbps upload. Service workers are blocked in both modes to isolate HTTP caching. A separate fixture-only interaction check verifies deferred dialog downloads, cancellation and the absence of a shake recipe request without motion permission.

Cold means an empty browser context with HTTP cache disabled; warm reuses that context with HTTP caching enabled. This does not simulate restarting Node or Mealie. The fixture serves the offline shell rather than SSR and contains one recipe with a small image, so its results measure browser startup regressions, not production backend or real image performance. Compare builds using the same fixture, machine, browser and environment variables.

The console reports TTFB, FCP, LCP and transferred JavaScript/font bytes. JSON attachments under `test-results` also include time until recipe content is visible, long tasks, API request start times/durations and Server-Timing values. Sampling ends one second after visible images complete. This is a startup snapshot, not a full-session analytics/download inventory. The fixture intentionally has no Server-Timing because it does not execute the BFF.

Analytics waits for queries to settle for one second, then an idle callback. Explicit application events and router pageviews queue with their original URL and timestamp until the SDK is ready. The queue is capped at 200 events while unavailable; SDK autocapture and exception recording begin when it loads. Service-worker installation still precaches application chunks for offline use, so a first installation may download deferred files in the background. This benchmark deliberately measures with that worker bypassed.

For a live run, set `PERF_BASE_URL` and optionally `PERF_STORAGE_STATE` to a local Playwright authentication-state file. Set `PERF_RECIPE_PATH` to an existing recipe path to include detail. Use `pnpm test:performance --output test-results/performance-live`. Authentication-state files contain credentials: keep them outside version control. Traces and videos are disabled; JSON reports omit cookies, headers, recipe identifiers and API query strings. Only run against an account authorised for the benchmark.

## Backend timing

Document and API responses now include fixed-name `Server-Timing` durations in milliseconds:

| Name | Meaning |
| --- | --- |
| `ssr` | HTML request middleware through creation of the response headers |
| `app` | Other request middleware through creation of response headers |
| `mealie` | Accumulated upstream request time until response headers, including retry delays |
| `identity` | Account lookup, including upstream request and decoding its response |
| `session_refresh` | Session refresh request until response headers |

These are overlapping measurements, not additive parts. Streaming body completion and browser/network/CDN time are outside the application total. Missing metrics mean that operation did not execute within the measured request; cached responses may contain earlier origin timings. The header contains no tokens, user IDs, URLs or error details. Request-scoped storage prevents concurrent users' measurements mixing.

To investigate a post-idle slow start, record document and API TTFB alongside these values in a live benchmark. Compare the application total with upstream/identity/refresh durations before attributing a delay to Mealie. Also retain browser-cache and service-worker conditions with the result.

## Step 2 comparison — 13 September 2026

The baseline is commit `87f600a`, built in an isolated temporary directory. Both builds used the fixed public settings above and the same benchmark with cached fixture weather. Values below are medians of three runs per condition. These local browser-startup results do not replace the earlier signed-in production audit.

| Page | Cold LCP before | Cold LCP after | Warm LCP before | Warm LCP after | Cold JS before → after |
| --- | ---: | ---: | ---: | ---: | ---: |
| Plan | 3.020 s | 2.332 s | 0.420 s | 0.400 s | 320.1 → 225.9 KB |
| Recipes | 3.128 s | 2.388 s | 0.624 s | 0.616 s | 318.2 → 225.9 KB |
| Recipe detail | 3.240 s | 2.560 s | 0.624 s | 0.608 s | 350.2 → 253.6 KB |

Cold font transfer fell from 128.0 to 87.3 KB on all three pages by using the system monospace font. Warm asset transfers remained zero. The main changes are deferred PostHog loading with queued events/pageviews, on-demand editing/import/shopping/About dialogs, and avoiding recipe-list subscriptions without granted motion permission. The browser regression check verifies that an interrupted dialog download can be cancelled and reopened.

JSON samples are saved locally in `test-results/performance-baseline-final` and `test-results/performance-final`. The optimized run passed all four browser checks. The full unit/interaction suite passed 921 tests, and the final Android/iPhone mobile and offline suite passed all 14 tests. One iPhone offline-shopping check initially timed out after reload; three isolated reruns and the subsequent full run passed. Keep this intermittent case separate from the stable startup measurements.
