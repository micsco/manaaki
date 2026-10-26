import { CLIENT_BUILD_HEADER } from "../api/clientBuild"
import { routeTemplate, UNMATCHED_ROUTE } from "./routeTemplate"
import { metrics, traced, withRequestContext } from "./telemetry"

export const CLIENT_TELEMETRY_HEADERS = [
  "x-posthog-distinct-id",
  "x-posthog-session-id",
  "x-posthog-window-id",
  CLIENT_BUILD_HEADER,
] as const

const NOT_A_ROUTE_STATUSES = new Set([403, 404])

function headerValue(request: Request, name: string): string | undefined {
  return request.headers.get(name)?.trim() || undefined
}

function clientBuildMatch(clientBuild: string | undefined): "current" | "other" | null {
  const serverBuild = import.meta.env.VITE_BUILD_GIT_SHORT_SHA
  if (!clientBuild || !serverBuild) return null
  return clientBuild === serverBuild ? "current" : "other"
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
  const clientBuild = headerValue(request, CLIENT_BUILD_HEADER)
  const buildMatch = clientBuildMatch(clientBuild)
  const options = {
    kind: "server" as const,
    parent: headerValue(request, "traceparent"),
    tracestate: headerValue(request, "tracestate"),
    attributes: {
      "http.request.method": method,
      "http.route": template,
      "url.path": url.pathname,
      "client.build": clientBuild,
      "client.build_current": buildMatch === null ? undefined : buildMatch === "current",
    },
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
        if (buildMatch)
          metrics.count("http.server.client_build_requests", 1, {
            attributes: { route, client_build: buildMatch },
          })
      }
    })
  )
}
