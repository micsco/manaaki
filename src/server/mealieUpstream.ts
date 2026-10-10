import { requestMethod } from "../api/retryingFetch"
import { mealieReadTimeoutMs, mealieStalledSlotHoldMs, mealieWriteTimeoutMs } from "./env"
import { MealieBusyError, mealieLimiter, type MealieSlot } from "./mealieLimiter"

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

export function acquireMealieSlot(signal?: AbortSignal): Promise<MealieSlot> {
  return mealieLimiter.acquire(signal)
}

export function releaseAfterFailure(slot: MealieSlot, error: unknown): void {
  if (error instanceof MealieTimeoutError) slot.releaseAfter(mealieStalledSlotHoldMs())
  else slot.release()
}

export async function mealieFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const callerSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined)
  const slot = await acquireMealieSlot(callerSignal ?? undefined)
  const deadline = AbortSignal.timeout(mealieTimeoutMs(requestMethod(input, init)))
  const signal = callerSignal ? AbortSignal.any([callerSignal, deadline]) : deadline
  try {
    const response = await fetch(input, { ...init, signal })
    slot.release()
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

export function upstreamFailureResponse(error: unknown): Response | null {
  if (error instanceof MealieTimeoutError) return failure(504, "Gateway Timeout")
  if (error instanceof MealieUnreachableError) return failure(502, "Bad Gateway")
  if (error instanceof MealieBusyError) {
    return failure(503, "Service Unavailable", { "Retry-After": BUSY_RETRY_AFTER_SECONDS })
  }
  return null
}
