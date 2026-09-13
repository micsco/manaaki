# Manaaki page-load investigation — 13 September 2026

The update-button fix was committed and pushed to `main` as `8c80918`. All 901 unit tests, type-checking, formatting/lint, and the production build passed. The deployed page showed that revision during this investigation.

The measured cold-load slowdown is primarily frontend startup and image delivery. The sampled Mealie-backed API responses were much shorter than the wait before the browser started requesting the page data. This does not rule out an intermittent slow Mealie response after a long idle period.

## Measurements

Tests used the signed-in production site at `https://manaaki.micsco.nz` in a separate Brave/Chromium tab. Navigation Timing, Resource Timing, buffered Largest Contentful Paint observations, long-task observations, and CDP network events were collected. No application data was edited.

“Cold” below means HTTP cache disabled and service worker bypassed for the test tab. It does **not** mean a restarted Mealie server, a fresh DNS/TLS connection, or a fresh PWA installation. The existing signed-in session was retained. The mobile simulation used a 390 × 844 viewport, 4× CPU slowdown, and configured network limits of 1.6 Mbps download, 0.75 Mbps upload, and 150 ms latency. These are controlled lab measurements, not measurements from an actual iPhone or field percentiles.

| Page and conditions | Runs | First content painted | Largest content painted (LCP) |
| --- | ---: | ---: | ---: |
| Meal plan, normal connection, cold browser cache | 3 | 0.11–0.56 s | 0.26–0.78 s |
| Meal plan, simulated mobile, cold browser cache | 3 | 1.09–1.11 s | 3.72–3.74 s |
| Meal plan, same mobile simulation, warm HTTP cache, service worker bypassed | 1 | 0.29 s | 0.70 s |
| Recipes list, simulated mobile, cold browser cache | 2 | 1.12–1.14 s | 7.84–8.07 s |
| Recipes list, normal connection, cold browser cache, phone viewport | 1 | 0.26 s | 1.27 s |
| Chicken Paprikash detail, simulated mobile, cold browser cache | 1 | 1.42 s | 3.24 s |

For the plan, the last LCP candidate was a meal title. For the list and detail, it was a recipe image. LCP does not mean every image is loaded or every button is interactive. The detail page rendered recipe content from the document before its client-side startup completed.

A supplementary test with the existing service worker enabled showed plan LCP at 0.59 s and zero network transfer for the app assets. It is excluded from the controlled cache comparison because page-level network throttling may not apply equally to service-worker-owned requests.

Google defines LCP as a measure of when the largest visible content is painted, rather than the document `load` event. Its good threshold is 2.5 seconds; values above 4 seconds are poor. These lab results should not be treated as a field Core Web Vitals assessment. [LCP measurement reference](https://web.dev/articles/lcp).

## Where the cold mobile time goes

Representative meal-plan run:

| Milestone | Time from navigation |
| --- | ---: |
| First document bytes | 0.09 s |
| First content paint | 1.09 s |
| Main JavaScript chunk finishes downloading | 3.07 s |
| Later `useMutation` module finishes downloading | 3.33 s |
| Client account request starts | 3.36 s |
| Meal-plan request starts | 3.40 s |
| Meal-plan response completes | 3.64 s |
| Meal title painted | 3.72 s |

The three cold mobile plan runs started the meal-plan request at 3.40–3.42 seconds. That request itself took only 238–249 ms, including the configured network conditions. Improving Mealie alone cannot remove the preceding roughly 3.4-second wait.

The controlled warm-HTTP-cache test retained the same CPU/network settings and still bypassed the service worker. It started the meal-plan request at 0.44 seconds and painted the meal title at 0.70 seconds. This strongly implicates asset download/startup cost. The roughly three-second difference is an observed cache benefit, **not** a promised saving from any single proposed code change.

## Main contributors and recommended order

1. **Reduce the JavaScript required before page data can load.** The plan downloaded about 520 KB of app scripts, styles, and fonts, including 373 KB of JavaScript. The main chunk accounted for 164 KB transferred, and `DialogClose-D9Flf8ir.js` another 108 KB. Built source maps show the misleadingly named `DialogClose` chunk is predominantly `posthog-js` and `@posthog/react`. Analytics is imported into the root and widely used through synchronous imports. Audit that dependency path before deferring analytics initialization and loading optional dialogs on demand; simply postponing a network call will not remove an eagerly imported bundle. [Root imports and provider](../src/routes/__root.tsx), [meal-plan dialog imports](../src/components/WeeklyMealPlan.tsx).

2. **Show the first recipe page without waiting for the entire collection.** `recipeListQueryOptions` awaits page 1, then pages 2 and 3 in parallel, and only then returns data. In the cold mobile list runs, page 1 finished at 4.06–4.09 seconds, but the full collection was unavailable until 4.57–4.69 seconds. Recipe titles painted at 4.75–4.89 seconds. Progressive pages could make the first cards available roughly half a second earlier in this trace, before considering other startup changes. Preserve full-collection search/filter behavior explicitly when changing this. [List query](../src/hooks/useRecipeList.ts:25).

3. **Deliver smaller, appropriately prioritized card images.** On the phone-sized recipes list, nine images began downloading together at about 4.74 seconds, including images below the viewport. They transferred 975 KB altogether. Visible cards displayed images at 356 × 192 CSS pixels, while sources included 800 × 600, 731 × 1024, and 1024 × 1024 images. Native lazy loading still loads nearby offscreen images. The first card's 140 KB image did not complete until 9.55 seconds in one run; another visible image became LCP at 7.84 seconds. Use responsive thumbnail variants, prioritize the first visible image, and keep more distant images from competing. Verify which image variants Mealie actually provides before changing URLs. [Recipe images](../src/routes/recipes.index.tsx:64), [current image URL helper](../src/utils/recipe.ts:50).

4. **Stop optional work from competing with the initial page.** `ShakeToRandomRecipe` is mounted globally and calls `useRecipeList()` even when motion permission is not granted. This explains the three collection requests on the meal-plan and detail pages. Defer that collection fetch until the feature is enabled/needed, while keeping recipe navigation requirements explicit. The plan already receives its displayed recipe summaries in the meal-plan response. [Global component](../src/components/ShakeToRandomRecipe.tsx:16).

5. **Trim smaller startup costs after the above.** Three fonts transferred 128 KB, including 40 KB for JetBrains Mono. The recipes list also loaded about 124 KB of additional analytics scripts after startup, including the recorder and surveys. Visible calorie badges requested three full recipe details, adding about 14 KB of responses; these are secondary to the main bundle and images. [Font imports](../src/routes/__root.tsx:29), [nutrition requests](../src/components/RecipeCardTimingBadges.tsx:29). The source-map package figures used to identify bundle contents are original source-text sizes, not exact per-package minified-byte attribution.

## What this says about Mealie

With browser and service-worker caches bypassed on the normal connection, the three plan runs measured:

| Request | Observed response duration |
| --- | ---: |
| Current account | 29–50 ms |
| Week's meal plan | 42–52 ms |
| Each recipe-list page | 70–90 ms |

The separate normal-network recipes-list run had account/list responses between 83 and 213 ms. None of these sampled data requests explains a multi-second cold startup by itself. These timings include the public network, Cloudflare, Manaaki's proxy, and Mealie; they are not direct measurements of Mealie's internal processing time.

The first uncached plan document after deployment waited about 445 ms for response headers, while the next two waited 39–43 ms. That is an origin-side outlier worth retaining, but it is insufficient evidence to attribute the delay to Mealie or to claim a reproducible server cold start. Response headers exposed Cloudflare timing, not separate Manaaki/Mealie timings. [How TTFB includes connection and response delays](https://web.dev/articles/ttfb).

The current code has two paths worth instrumenting for an occasional slow start:

- `/plan` checks identity before rendering on the server; resolving that identity calls Mealie. The client subsequently makes its own account request. This is a potential extra round trip, but the measured account calls were short. [Plan guard](../src/routes/plan.tsx), [identity resolution](../src/server/currentUser.ts).
- API requests can refresh the Mealie session before forwarding a request. That can add a round trip after the token passes its refresh point; this investigation did not observe or force an expiring-session case. [Session refresh](../src/server/proxy.ts:114).

For a conclusive backend diagnosis, add `Server-Timing` measurements around identity lookup, session refresh, upstream Mealie response headers, and document rendering, then record a normal launch after a long idle period. This would distinguish a slow Mealie response from Node/SSR startup, proxy delay, and frontend downloads without changing the user's session lifetime or restarting production services.

The service worker also uses a network-first document request with no explicit application timeout before falling back to the offline shell. A connection that stalls without failing could therefore delay a cached app's launch. This is a code-based hypothesis, not a reproduced issue in these runs. [Navigation handler](../src/pwa/worker.ts:512).

## Scope and next step

The performance investigation made no production configuration changes and no optimization code changes. Browser cache bypass, service-worker bypass, viewport, CPU, and network overrides were restored after testing. The dedicated test tab was closed. Existing user tabs, cookies, and offline data were retained.

Start with the initial JavaScript dependency path and progressive recipe-list loading, then right-size and prioritize card images. Rerun the same cold and warm scenarios after each change. Separately instrument the backend to catch the occasional post-idle slow response rather than assuming Mealie is always the cause.
