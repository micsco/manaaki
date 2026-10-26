# Observability

Manaaki's server sends traces, metrics and AI events to PostHog (EU) through the
`posthog-node` client in `src/server/telemetry.ts`. Nothing is sent in tests or when
no project token is set. Queued data is sent when the server shuts down.

## Setup

The server uses `POSTHOG_PROJECT_TOKEN`, or the build's
`VITE_PUBLIC_POSTHOG_PROJECT_TOKEN` when that is unset, so the existing Dokploy build
argument is enough. Set `POSTHOG_INGESTION_HOST` only to leave PostHog EU.

Metrics are in open alpha: enable them once under **Metrics** in PostHog.

## Traces

Every request to the server is a span named by its route, such as
`GET /api/recipes/{slug}` or `GET /recipes/{id}/{slug}`. Paths outside the app, and
any request answered 403 or 404, are named `unmatched` so made-up URLs can't create
new names. Inside a request:

| Span | What it covers |
|------|----------------|
| `mealie` | One call to Mealie, with `mealie.route` and `mealie.response.status_code`; an error when Mealie answers 5xx |
| `mealie.slot_wait` | Queueing for one of Mealie's connection slots, only when all are busy |
| `identity`, `session_refresh` | Looking up the signed-in user, refreshing their token |
| `recipe_version.draft` | Writing an AI recipe version, with tokens, model and outcome; a cook leaving mid-draft is `recipe_version.abandoned`, not an error |

The browser sends `X-POSTHOG-DISTINCT-ID` and `X-POSTHOG-SESSION-ID` on its own
requests (`tracing_headers` in `src/lib/loadAnalytics.ts`), so a request's spans
carry the person and the session replay they belong to. The proxy removes these
headers before calling Mealie.

Browser API calls also send `X-Manaaki-Build` with the running build (`src/api/clientBuild.ts`).
Request spans record it as `client.build` and `client.build_current`, and
`http.server.client_build_requests` counts requests from the current build and from
older or newer tabs by route. The proxy strips this header too.

## AI observability

Recipe version drafts call models through TanStack AI. Every call (the draft, any
repair and any escalation) records an `$ai_generation` event through `@posthog/ai`'s
`captureAiGeneration`, with the prompt, the reply, tokens, latency and a `purpose`
property (`draft`, `repair` or `escalation`). The event's `$ai_trace_id` is the
draft's trace ID, and it carries the browser's distinct ID and `$session_id`. Claude
calls don't report thinking tokens separately; they are included in output tokens.

To go from a slow draft to its model call, take the trace ID from
`posthog.trace_spans` with `lower(hex(tryBase64Decode(trace_id)))` and look for that
value as `$ai_trace_id` on `$ai_generation` events. The two tables can't be joined in
one query; see PostHog's
[Link traces to AI Observability](https://posthog.com/docs/distributed-tracing/link-ai-observability).

## Metrics

| Metric | Type | Attributes |
|--------|------|------------|
| `http.server.request.duration` | histogram (ms) | `method`, `route`, `status_class` |
| `server.timing.duration` | histogram (ms) | `name` (`ssr`, `app`, `mealie`, `identity`, `session_refresh`) |
| `mealie.slots.active`, `mealie.slots.waiting` | gauge | — |
| `mealie.slot_wait.duration` | histogram (ms) | — |
| `mealie.upstream.failures` | counter | `reason` (`busy`, `timeout`, `unreachable`) |
| `recipe_version.drafts` | counter | `target`, `model`, `outcome` (`ok`, `error`, `abandoned`), `status` |
| `recipe_version.draft.duration` | histogram (ms) | `target`, `model`, `outcome` |
| `recipe_version.draft.tokens` | histogram | `model`, `kind` (`input`, `output`, `thinking`) |

`mealie.slots.active` staying at `MEALIE_CONCURRENCY_LIMIT` while `mealie.slots.waiting`
climbs is the early sign of Mealie's connection pool wedging. Keep metric attributes
to small fixed sets; recipe IDs and people belong on spans.

## Browser telemetry

`posthog-js` loads as `manaaki-web` and registers `app_version` (the short build SHA)
on every event, so errors, replays and funnels can be split by build. Code outside
React reports through `appAnalytics` in `src/lib/analytics.ts`, which queues events
and metrics until PostHog has loaded.

App updates (`src/hooks/useAutoUpdate.ts`) send these events:

| Event | When |
|-------|------|
| `app_update_detected` | A new build is first found, with `source` (`worker-waiting`, `worker-activated`, `version-file`) |
| `app_updated` | The page reloaded onto the new build, with `trigger`, `held_ms` and the worker `activation` |
| `app_update_failed` | The page reloaded but is still on the old build |
| `app_update_prompt_shown` | An update was held for 12 hours and the Update prompt appeared |

And these metrics:

| Metric | Type | Attributes |
|--------|------|------------|
| `app_update.applied`, `app_update.failed` | counter | `trigger`, `activation` (`activated`, `timeout`, `none-waiting`, `unsupported`, `failed`) |
| `app_update.held.duration` | histogram (ms) | `trigger` |
| `app_update.held_back` | counter | `trigger`, `reason` (each hold reason, once per update) |
| `app_update.version_check` | counter | `outcome` (`same`, `newer`, `failed`) |
| `app_update.missing_file` | counter | `outcome` (`reloaded`, `loop_guarded`) |
| `draft.restored` | counter | `kind` (first part of the draft key, e.g. `meal-plan`) |
| `draft.expired` | counter | `kind` |

A draft counts as restored only when it was saved before the current page load.

