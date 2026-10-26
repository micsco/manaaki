import { routeTemplate, UNMATCHED_ROUTE } from "./routeTemplate"
import { metrics, traced, withRequestContext } from "./telemetry"

export const POSTHOG_TRACING_HEADERS = [
  "x-posthog-distinct-id",
  "x-posthog-session-id",
  "x-posthog-window-id",
] as const

const NOT_A_ROUTE_STATUSES = new Set([403, 404])

function headerValue(request: Request, name: string): string | undefined {
  return request.headers.get(name)?.trim() || undefined
}

export function traceRequest<T extends { response: Response }>(
  request: Request,
  next: () => T | Promise<T>
): Promise<T> {
  const url = new URL(request.url)
  const method = request.method.toUpperCase()
  const template = routeTemplate(url.pathname)
  const context = {
    distinctId: headerValue(request, "x-posthog-distinct-id"),
    sessionId: headerValue(request, "x-posthog-session-id"),
  }
  const options = {
    kind: "server" as const,
    parent: headerValue(request, "traceparent"),
    tracestate: headerValue(request, "tracestate"),
    attributes: { "http.request.method": method, "http.route": template, "url.path": url.pathname },
  }
  return withRequestContext(context, () =>
    traced(`${method} ${template}`, options, async span => {
      const startedAt = performance.now()
      let route = template
      let statusClass = "error"
      try {
        const result = await next()
        const status = result.response.status
        statusClass = `${Math.floor(status / 100)}xx`
        if (NOT_A_ROUTE_STATUSES.has(status)) {
          route = UNMATCHED_ROUTE
          span.updateName(`${method} ${UNMATCHED_ROUTE}`)
        }
        span.setAttribute("http.response.status_code", status)
        if (status >= 500) span.setStatus("error")
        return result
      } finally {
        metrics.histogram("http.server.request.duration", performance.now() - startedAt, {
          unit: "ms",
          attributes: { method, route, status_class: statusClass },
        })
      }
    })
  )
}
