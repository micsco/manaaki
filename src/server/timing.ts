import { AsyncLocalStorage } from "node:async_hooks"

type TimingName = "app" | "ssr" | "mealie" | "identity" | "session_refresh"

const requestTimings = new AsyncLocalStorage<Map<TimingName, number>>()

export async function measureServerTiming<T>(name: TimingName, operation: () => T | Promise<T>) {
  const timings = requestTimings.getStore()
  if (!timings) return operation()
  const started = performance.now()
  try {
    return await operation()
  } finally {
    timings.set(name, (timings.get(name) ?? 0) + performance.now() - started)
  }
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
