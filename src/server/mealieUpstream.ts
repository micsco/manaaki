import { requestMethod } from "../api/retryingFetch"
import { mealieReadTimeoutMs, mealieWriteTimeoutMs } from "./env"

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

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
  return error instanceof MealieTimeoutError
}

export async function mealieFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const callerSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined)
  const deadline = AbortSignal.timeout(mealieTimeoutMs(requestMethod(input, init)))
  const signal = callerSignal ? AbortSignal.any([callerSignal, deadline]) : deadline
  try {
    return await fetch(input, { ...init, signal })
  } catch (error) {
    if (deadline.aborted && !callerSignal?.aborted) {
      throw new MealieTimeoutError("Mealie did not answer in time", { cause: error })
    }
    throw error
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
  return null
}
