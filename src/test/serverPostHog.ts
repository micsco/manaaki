import { PostHog, type SpanRecord } from "posthog-node"
import { vi } from "vitest"

import { setServerPostHog } from "../server/telemetry"

type MetricSample = {
  name: string
  type: string
  value: number
  unit?: string
  attributes?: Record<string, unknown>
}

export function installTestPostHog() {
  const spans: SpanRecord[] = []
  const samples: MetricSample[] = []
  const client = new PostHog("phc_test", {
    host: "http://posthog.invalid",
    fetch: vi.fn(async () => new Response("{}")),
    flushAt: 1000,
    traces: {
      serviceName: "manaaki-test",
      beforeSpanSend: span => {
        spans.push(span)
        return null
      },
    },
    metrics: {
      serviceName: "manaaki-test",
      beforeSend: sample => {
        samples.push(sample)
        return null
      },
    },
  })
  const capture = vi.spyOn(client, "capture")
  setServerPostHog(client)
  return {
    client,
    spans,
    samples,
    capture,
    span: (name: string) => spans.find(span => span.name === name),
    async flushMetrics() {
      await client.metrics.flush()
      return samples
    },
    async uninstall() {
      setServerPostHog(null)
      await client.shutdown()
    },
  }
}
