export type AnalyticsClient = {
  capture: (
    event: string,
    properties?: Record<string, unknown>,
    options?: { timestamp: Date }
  ) => unknown
}

type QueuedEvent = {
  event: string
  properties: Record<string, unknown>
  timestamp: Date
}

export function createBufferedAnalytics(enabled: boolean) {
  let client: AnalyticsClient | undefined
  const queue: QueuedEvent[] = []
  return {
    capture(event: string, properties?: Record<string, unknown>) {
      if (!enabled || typeof window === "undefined") return
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
      else {
        if (queue.length >= 200) queue.shift()
        queue.push(entry)
      }
    },
    connect(nextClient: AnalyticsClient) {
      client = nextClient
      for (const entry of queue.splice(0))
        client.capture(entry.event, entry.properties, { timestamp: entry.timestamp })
    },
  }
}
