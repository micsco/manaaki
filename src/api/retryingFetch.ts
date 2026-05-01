const RETRYABLE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])
const MAX_ATTEMPTS = 3
const BASE_DELAY_MS = 500

function isRetryableResponse(response: Response): boolean {
  return response.status === 429 || response.status >= 500
}

function backoffDelay(attempt: number): number {
  const exponential = BASE_DELAY_MS * 2 ** attempt
  const jitter = Math.random() * BASE_DELAY_MS
  return exponential + jitter
}

type FetchResult = { ok: true; response: Response } | { ok: false; error: unknown }

async function attemptFetch(input: RequestInfo | URL, init?: RequestInit): Promise<FetchResult> {
  try {
    const response = await fetch(input, init)
    return { ok: true, response }
  } catch (error) {
    return { ok: false, error }
  }
}

export async function retryingFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase()
  const shouldRetry = RETRYABLE_METHODS.has(method)

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await new Promise(resolve => setTimeout(resolve, backoffDelay(attempt - 1)))
    }

    const result = await attemptFetch(input, init)

    if (!result.ok) {
      if (!shouldRetry || attempt === MAX_ATTEMPTS - 1) throw result.error
      continue
    }

    if (shouldRetry && isRetryableResponse(result.response) && attempt < MAX_ATTEMPTS - 1) {
      continue
    }

    return result.response
  }

  throw new Error("retryingFetch: exhausted all attempts")
}
