const RETRYABLE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])
const MAX_ATTEMPTS = 2
const BASE_DELAY_MS = 500

type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

function isNetworkFailure(error: unknown): boolean {
  return error instanceof TypeError
}

export function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  return (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase()
}

function backoffDelay(attempt: number): number {
  const exponential = BASE_DELAY_MS * 2 ** attempt
  const jitter = Math.random() * BASE_DELAY_MS
  return exponential + jitter
}

export async function retryingFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  send: Fetch = fetch
): Promise<Response> {
  const attempts = RETRYABLE_METHODS.has(requestMethod(input, init)) ? MAX_ATTEMPTS : 1

  for (let attempt = 0; ; attempt++) {
    if (attempt > 0) {
      await new Promise(resolve => setTimeout(resolve, backoffDelay(attempt - 1)))
    }
    try {
      return await send(input, init)
    } catch (error) {
      if (attempt === attempts - 1 || !isNetworkFailure(error)) throw error
    }
  }
}
