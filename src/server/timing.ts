import { AsyncLocalStorage } from "node:async_hooks"

import { metrics, traced } from "./telemetry"

type TimingName = "app" | "ssr" | "mealie" | "identity" | "session_refresh"

const UPSTREAM_TIMINGS = new Set<TimingName>(["mealie", "identity", "session_refresh"])

const requestTimings = new AsyncLocalStorage<Map<TimingName, number>>()

export function measureServerTiming<T>(
  name: TimingName,
  operation: () => T | Promise<T>
): Promise<T> {
  const measure = async () => {
    const started = performance.now()
    try {
      return await operation()
    } finally {
      const duration = performance.now() - started
      metrics.histogram("server.timing.duration", duration, { unit: "ms", attributes: { name } })
      const timings = requestTimings.getStore()
      timings?.set(name, (timings.get(name) ?? 0) + duration)
    }
  }
  return UPSTREAM_TIMINGS.has(name) ? traced(name, { kind: "client" }, measure) : measure()
}

export function withServerTiming<T extends { response: Response }>(
  operation: () => T | Promise<T>,
  name: "app" | "ssr" = "app"
): Promise<T> {
  return requestTimings.run(new Map(), async () => {
    const result = await measureServerTiming(name, operation)
    const timings = requestTimings.getStore()!
    const headers = new Headers(result.response.headers)
    headers.append(
      "Server-Timing",
      [...timings].map(([metric, duration]) => `${metric};dur=${duration.toFixed(1)}`).join(", ")
    )
    return {
      ...result,
      response: new Response(result.response.body, {
        status: result.response.status,
        statusText: result.response.statusText,
        headers,
      }),
    }
  })
}
