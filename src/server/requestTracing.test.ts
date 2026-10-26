import { afterEach, describe, expect, it } from "vitest"

import { installTestPostHog } from "../test/serverPostHog"
import { traceRequest } from "./requestTracing"
import { requestContext, traced } from "./telemetry"

const TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736"

let posthog: ReturnType<typeof installTestPostHog>

afterEach(() => posthog.uninstall())

function request(path: string, headers: Record<string, string> = {}) {
  return new Request(`https://manaaki.test${path}`, { headers })
}

describe("traceRequest", () => {
  it("names the span by route and links it to the browser's session and trace", async () => {
    posthog = installTestPostHog()
    let context: ReturnType<typeof requestContext> | undefined
    await traceRequest(
      request("/api/recipes/chicken-fajitas", {
        traceparent: `00-${TRACE_ID}-00f067aa0ba902b7-01`,
        "X-POSTHOG-DISTINCT-ID": "person-1",
        "X-POSTHOG-SESSION-ID": "session-1",
      }),
      async () => {
        context = requestContext()
        traced("mealie", { kind: "client" }, () => undefined)
        return { response: new Response("ok", { status: 200 }) }
      }
    )
    const span = posthog.span("GET /api/recipes/{slug}")!
    expect(span.kind).toBe("server")
    expect(span.traceId).toBe(TRACE_ID)
    expect(span.attributes).toMatchObject({
      "http.route": "/api/recipes/{slug}",
      "url.path": "/api/recipes/chicken-fajitas",
      "http.response.status_code": 200,
      posthogDistinctId: "person-1",
      sessionId: "session-1",
    })
    expect(posthog.span("mealie")?.parentSpanId).toBe(span.spanId)
    expect(context).toEqual({ distinctId: "person-1", sessionId: "session-1" })
  })

  it("marks server errors and records request duration by status class", async () => {
    posthog = installTestPostHog()
    await traceRequest(request("/plan"), async () => ({
      response: new Response("broken", { status: 503 }),
    }))
    expect(posthog.span("GET /plan")?.status?.code).toBe("error")
    expect(await posthog.flushMetrics()).toContainEqual(
      expect.objectContaining({
        name: "http.server.request.duration",
        type: "histogram",
        unit: "ms",
        attributes: { method: "GET", route: "/plan", status_class: "5xx" },
      })
    )
  })

  it.each([403, 404])("groups %i responses so made-up paths share one name", async status => {
    posthog = installTestPostHog()
    await traceRequest(request("/api/made-up-thing"), async () => ({
      response: new Response(null, { status }),
    }))
    const span = posthog.span("GET unmatched")
    expect(span?.attributes).toMatchObject({ "url.path": "/api/made-up-thing" })
    expect(await posthog.flushMetrics()).toContainEqual(
      expect.objectContaining({
        name: "http.server.request.duration",
        attributes: { method: "GET", route: "unmatched", status_class: "4xx" },
      })
    )
  })

  it("still records the request when the handler throws", async () => {
    posthog = installTestPostHog()
    await expect(
      traceRequest(request("/shopping"), async () => {
        throw new Error("render failed")
      })
    ).rejects.toThrow("render failed")
    expect(posthog.span("GET /shopping")?.status?.code).toBe("error")
    expect(await posthog.flushMetrics()).toContainEqual(
      expect.objectContaining({
        name: "http.server.request.duration",
        attributes: { method: "GET", route: "/shopping", status_class: "error" },
      })
    )
  })

  it("keeps requests apart when the browser sends no PostHog headers", async () => {
    posthog = installTestPostHog()
    await traceRequest(request("/", { "x-posthog-distinct-id": "person-1" }), async () => ({
      response: new Response(),
    }))
    let anonymous: ReturnType<typeof requestContext> | undefined
    await traceRequest(request("/"), async () => {
      anonymous = requestContext()
      return { response: new Response() }
    })
    expect(anonymous).toEqual({ distinctId: undefined, sessionId: undefined })
  })
})
