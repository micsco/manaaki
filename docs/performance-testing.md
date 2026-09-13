# Startup performance

Build once, then run `pnpm test:performance`. The benchmark uses the production browser bundle with a local fixture API and compressed, cacheable assets. It runs three fresh-browser cold/warm pairs for the plan, recipe list and recipe detail, sequentially. Each run uses a 390 × 844 viewport, 4× CPU slowdown, 150 ms simulated latency, 1.6 Mbps download and 0.75 Mbps upload. Service workers are blocked in both modes to isolate HTTP caching.

Cold means an empty browser context with HTTP cache disabled; warm reuses that context with HTTP caching enabled. This does not simulate restarting Node or Mealie. The fixture serves the offline shell rather than SSR and contains one recipe with a small image, so its results measure browser startup regressions, not production backend or real image performance. Compare builds using the same fixture, machine, browser and environment variables.

The console reports TTFB, FCP, LCP and transferred JavaScript/font bytes. JSON attachments under `test-results` also include time until recipe content is visible, long tasks, API request start times/durations and Server-Timing values. Sampling ends one second after visible images complete. This is a startup snapshot, not a full-session analytics/download inventory. The fixture intentionally has no Server-Timing because it does not execute the BFF.

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
