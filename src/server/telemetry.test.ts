import { afterEach, describe, expect, it } from "vitest"

import { installTestPostHog } from "../test/serverPostHog"
import {
  activeTraceId,
  metrics,
  requestContext,
  serverPostHog,
  setServerPostHog,
  telemetryOptions,
  traced,
  withRequestContext,
} from "./telemetry"

const INBOUND_TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736"
const INBOUND_TRACEPARENT = `00-${INBOUND_TRACE_ID}-00f067aa0ba902b7-01`

let posthog: ReturnType<typeof installTestPostHog> | undefined

afterEach(async () => {
  await posthog?.uninstall()
  posthog = undefined
  setServerPostHog(null)
})

describe("telemetryOptions", () => {
  it("names the service for both traces and metrics", () => {
    const options = telemetryOptions()
    expect(options.host).toBe("https://eu.i.posthog.com")
    expect(options.traces).toMatchObject({ serviceName: "manaaki" })
    expect(options.metrics).toMatchObject({ serviceName: "manaaki" })
    expect(options.traces).toMatchObject({ environment: import.meta.env.MODE })
    expect(options.metrics).toMatchObject({ environment: import.meta.env.MODE })
  })
})

describe("without a PostHog token", () => {
  it("stays off in tests and still runs the traced work", async () => {
    expect(serverPostHog()).toBeNull()
    const result = await traced("work", {}, async span => {
      span.setAttribute("ignored", true).setStatus("ok")
      return "done"
    })
    expect(result).toBe("done")
    expect(activeTraceId()).toBeUndefined()
    expect(requestContext()).toEqual({ distinctId: undefined, sessionId: undefined })
    expect(() => metrics.count("noop")).not.toThrow()
    expect(withRequestContext({ distinctId: "person" }, () => "ran")).toBe("ran")
  })
})

describe("with a PostHog client", () => {
  it("nests spans across awaits under one trace", async () => {
    posthog = installTestPostHog()
    let innerTraceId: string | undefined
    await traced("outer", { kind: "server" }, async () => {
      await new Promise(resolve => setTimeout(resolve, 1))
      await traced("inner", {}, async () => {
        innerTraceId = activeTraceId()
      })
    })
    const outer = posthog.span("outer")!
    const inner = posthog.span("inner")!
    expect(inner.traceId).toBe(outer.traceId)
    expect(inner.parentSpanId).toBe(outer.spanId)
    expect(innerTraceId).toBe(outer.traceId)
  })

  it("continues a trace started by the browser", async () => {
    posthog = installTestPostHog()
    traced("request", { parent: INBOUND_TRACEPARENT }, () => undefined)
    expect(posthog.span("request")?.traceId).toBe(INBOUND_TRACE_ID)
  })

  it("links spans to the person and session of the request", async () => {
    posthog = installTestPostHog()
    withRequestContext({ distinctId: "person-1", sessionId: "session-1" }, () =>
      traced("request", {}, () => {
        expect(requestContext()).toEqual({ distinctId: "person-1", sessionId: "session-1" })
      })
    )
    expect(posthog.span("request")?.attributes).toMatchObject({
      posthogDistinctId: "person-1",
      sessionId: "session-1",
    })
  })

  it("records an error status when traced work throws", async () => {
    posthog = installTestPostHog()
    await expect(
      traced("failing", {}, async () => {
        throw new Error("boom")
      })
    ).rejects.toThrow("boom")
    expect(posthog.span("failing")?.status?.code).toBe("error")
  })

  it("sends counters, gauges and histograms", async () => {
    posthog = installTestPostHog()
    metrics.count("jobs.done", 2, { attributes: { kind: "a" } })
    metrics.gauge("queue.depth", 3)
    metrics.histogram("job.duration", 40, { unit: "ms" })
    const samples = await posthog.flushMetrics()
    expect(samples).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "jobs.done", type: "count", value: 2 }),
        expect.objectContaining({ name: "queue.depth", type: "gauge", value: 3 }),
        expect.objectContaining({ name: "job.duration", type: "histogram", unit: "ms" }),
      ])
    )
  })
})
