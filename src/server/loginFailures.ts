import { activeSpan, metrics } from "./telemetry"

export type LoginFailureStage = "start" | "provider" | "complete"

const PROVIDER_ERROR_CODE = /^[a-z_]{1,64}$/

function describe(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`
  return typeof error === "string" && PROVIDER_ERROR_CODE.test(error) ? error : "unknown"
}

export function reportLoginFailure(stage: LoginFailureStage, error: unknown): void {
  const reason = describe(error)
  console.error(`Sign-in failed at ${stage}: ${reason}`)
  const span = activeSpan()
  span.setAttributes({ "auth.login.failure_stage": stage })
  span.setStatus("error", reason)
  metrics.count("auth.login.failures", 1, { attributes: { stage } })
}
