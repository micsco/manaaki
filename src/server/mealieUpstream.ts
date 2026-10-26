import { requestMethod } from "../api/retryingFetch"
import { mealieReadTimeoutMs, mealieStalledSlotHoldMs, mealieWriteTimeoutMs } from "./env"
import { MealieBusyError, mealieLimiter, type MealieSlot } from "./mealieLimiter"
import { routeTemplate } from "./routeTemplate"
import { activeSpan, metrics, type Span, traced } from "./telemetry"

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"])
const BUSY_RETRY_AFTER_SECONDS = "2"

export class MealieTimeoutError extends Error {
  override name = "MealieTimeoutError"
}

export class MealieUnreachableError extends Error {
  override name = "MealieUnreachableError"
}

export function mealieTimeoutMs(method: string): number {
  return READ_METHODS.has(method.toUpperCase()) ? mealieReadTimeoutMs() : mealieWriteTimeoutMs()
}

export function isMealieOverloaded(error: unknown): boolean {
  return error instanceof MealieTimeoutError || error instanceof MealieBusyError
}

export async function acquireMealieSlot(signal?: AbortSignal): Promise<MealieSlot> {
  const startedAt = performance.now()
  const acquire = () => mealieLimiter.acquire(signal)
  try {
    return await (mealieLimiter.hasCapacity() ? acquire() : traced("mealie.slot_wait", {}, acquire))
  } finally {
    metrics.histogram("mealie.slot_wait.duration", performance.now() - startedAt, { unit: "ms" })
  }
}

export function describeMealieCall(method: string, pathname: string): Span {
  return activeSpan().setAttributes({
    "mealie.request.method": method.toUpperCase(),
    "mealie.route": routeTemplate(pathname),
  })
}

export function recordMealieStatus(span: Span, status: number) {
  span.setAttribute("mealie.response.status_code", status)
  if (status >= 500) span.setStatus("error")
}

function requestPath(input: RequestInfo | URL): string {
  const href = input instanceof Request ? input.url : String(input)
  return URL.canParse(href) ? new URL(href).pathname : href
}

export function releaseAfterFailure(slot: MealieSlot, error: unknown): void {
  if (error instanceof MealieTimeoutError) slot.releaseAfter(mealieStalledSlotHoldMs())
  else slot.release()
}

export async function mealieFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = requestMethod(input, init)
  const span = describeMealieCall(method, requestPath(input))
  const callerSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined)
  const slot = await acquireMealieSlot(callerSignal ?? undefined)
  const deadline = AbortSignal.timeout(mealieTimeoutMs(method))
  const signal = callerSignal ? AbortSignal.any([callerSignal, deadline]) : deadline
  try {
    const response = await fetch(input, { ...init, signal })
    slot.release()
    recordMealieStatus(span, response.status)
    return response
  } catch (error) {
    const failure =
      deadline.aborted && !callerSignal?.aborted
        ? new MealieTimeoutError("Mealie did not answer in time", { cause: error })
        : error
    releaseAfterFailure(slot, failure)
    throw failure
  }
}

function failure(status: number, statusText: string, headers: Record<string, string> = {}) {
  return new Response(statusText, {
    status,
    statusText,
    headers: { "Cache-Control": "no-store", "Content-Type": "text/plain", ...headers },
  })
}

function upstreamFailureReason(error: unknown) {
  if (error instanceof MealieTimeoutError) return "timeout"
  if (error instanceof MealieUnreachableError) return "unreachable"
  if (error instanceof MealieBusyError) return "busy"
  return null
}

export function upstreamFailureResponse(error: unknown): Response | null {
  const reason = upstreamFailureReason(error)
  if (!reason) return null
  metrics.count("mealie.upstream.failures", 1, { attributes: { reason } })
  if (reason === "timeout") return failure(504, "Gateway Timeout")
  if (reason === "unreachable") return failure(502, "Bad Gateway")
  return failure(503, "Service Unavailable", { "Retry-After": BUSY_RETRY_AFTER_SECONDS })
}
