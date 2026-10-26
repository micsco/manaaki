export type MetricOptions = {
  unit?: string
  attributes?: Record<string, string | number | boolean>
}

type MetricKind = "count" | "gauge" | "histogram"

type MetricsClient = Record<
  MetricKind,
  (name: string, value: number, options?: MetricOptions) => void
>

export type AnalyticsClient = {
  capture: (
    event: string,
    properties?: Record<string, unknown>,
    options?: { timestamp: Date }
  ) => unknown
  metrics?: MetricsClient
}

type QueuedEvent = {
  event: string
  properties: Record<string, unknown>
  timestamp: Date
}

type QueuedMetric = { kind: MetricKind; name: string; value: number; options?: MetricOptions }

const MAX_QUEUED = 200

function boundedPush<T>(queue: T[], entry: T) {
  if (queue.length >= MAX_QUEUED) queue.shift()
  queue.push(entry)
}

export function createBufferedAnalytics(enabled: boolean | (() => boolean)) {
  const isEnabled = () =>
    typeof window !== "undefined" && (typeof enabled === "function" ? enabled() : enabled)
  let client: AnalyticsClient | undefined
  let events: QueuedEvent[] = []
  let metrics: QueuedMetric[] = []

  const record = (kind: MetricKind) => (name: string, value: number, options?: MetricOptions) => {
    if (!isEnabled()) return
    if (client) client.metrics?.[kind](name, value, options)
    else boundedPush(metrics, { kind, name, value, options })
  }

  return {
    capture(event: string, properties?: Record<string, unknown>) {
      if (!isEnabled()) return
      const entry = {
        event,
        properties: {
          $current_url: window.location.href,
          $pathname: window.location.pathname,
          ...properties,
        },
        timestamp: new Date(),
      }
      if (client) client.capture(entry.event, entry.properties, { timestamp: entry.timestamp })
      else boundedPush(events, entry)
    },
    count: (name: string, value = 1, options?: MetricOptions) =>
      record("count")(name, value, options),
    gauge: record("gauge"),
    histogram: record("histogram"),
    connect(nextClient: AnalyticsClient) {
      client = nextClient
      for (const entry of events.splice(0))
        client.capture(entry.event, entry.properties, { timestamp: entry.timestamp })
      for (const metric of metrics.splice(0))
        client.metrics?.[metric.kind](metric.name, metric.value, metric.options)
    },
    reset() {
      client = undefined
      events = []
      metrics = []
    },
  }
}

export type BufferedAnalytics = ReturnType<typeof createBufferedAnalytics>

export type AppAnalytics = Pick<BufferedAnalytics, "capture" | "count" | "gauge" | "histogram">

export const appAnalytics = createBufferedAnalytics(() =>
  Boolean(import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN)
)
