import {
  type CaptureMetricOptions,
  PostHog,
  type PostHogOptions,
  type Span,
  type SpanAttributes,
  type SpanStatusCode,
  type StartSpanOptions,
} from "posthog-node"

import { posthogIngestionHost, posthogProjectToken } from "./env"

export type { Span }

export type RequestContext = { distinctId?: string; sessionId?: string }

const MISSING_TOKEN_WARNING =
  "POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured"

class InertSpan implements Span {
  setAttribute(_key: string, _value: unknown) {
    return this
  }
  setAttributes(_attributes: SpanAttributes) {
    return this
  }
  addEvent(_name: string) {
    return this
  }
  setStatus(_status: SpanStatusCode, _message?: string) {
    return this
  }
  recordException(_error: unknown) {
    return this
  }
  updateName(_name: string) {
    return this
  }
  traceparent() {
    return null
  }
  tracestate() {
    return null
  }
  end() {}
}

const inertSpan = new InertSpan()

let client: PostHog | null | undefined

export function telemetryOptions(): PostHogOptions {
  const service = {
    serviceName: "manaaki",
    serviceVersion: import.meta.env.VITE_BUILD_GIT_SHA || undefined,
    environment: globalThis.process?.env?.NODE_ENV || "development",
  }
  return { host: posthogIngestionHost(), traces: service, metrics: service }
}

function createClient(): PostHog | null {
  if (import.meta.env.MODE === "test") return null
  const token = posthogProjectToken()
  if (token) {
    const posthog = new PostHog(token, telemetryOptions())
    globalThis.process?.once?.("beforeExit", () => void posthog.shutdown())
    return posthog
  }
  if (globalThis.process?.env?.NODE_ENV === "development") console.warn(MISSING_TOKEN_WARNING)
  return null
}

export function serverPostHog(): PostHog | null {
  if (client === undefined) client = createClient()
  return client
}

export function setServerPostHog(next: PostHog | null) {
  client = next
}

export function traced<T>(
  name: string,
  options: StartSpanOptions,
  operation: (span: Span) => T
): T {
  const posthog = serverPostHog()
  return posthog ? posthog.withSpan(name, options, operation) : operation(inertSpan)
}

export function activeSpan(): Span {
  return serverPostHog()?.getActiveSpan() ?? inertSpan
}

export function activeTraceId(): string | undefined {
  return activeSpan().traceparent()?.split("-")[1]
}

export function withRequestContext<T>(context: RequestContext, operation: () => T): T {
  const posthog = serverPostHog()
  return posthog ? posthog.withContext(context, operation, { fresh: true }) : operation()
}

export function requestContext(): RequestContext {
  const context = serverPostHog()?.getContext()
  return { distinctId: context?.distinctId, sessionId: context?.sessionId }
}

export const metrics = {
  count(name: string, value = 1, options?: CaptureMetricOptions) {
    serverPostHog()?.metrics.count(name, value, options)
  },
  gauge(name: string, value: number, options?: CaptureMetricOptions) {
    serverPostHog()?.metrics.gauge(name, value, options)
  },
  histogram(name: string, value: number, options?: CaptureMetricOptions) {
    serverPostHog()?.metrics.histogram(name, value, options)
  },
}
