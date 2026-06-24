import { client } from "./generated/client.gen"
import { retryingFetch } from "./retryingFetch"

const isServer = typeof window === "undefined"
let configured = false

export function configureApiClient() {
  if (configured) {
    return
  }
  client.setConfig({
    baseUrl: isServer ? (globalThis.process?.env?.MEALIE_INTERNAL_URL ?? "") : "",
    fetch: retryingFetch,
    // Server-side SSR of PUBLIC pages uses the constant read-only token.
    // The browser sends relative /api requests; the BFF attaches the per-user
    // or read-only token from the session cookie. Never a per-user token here.
    headers:
      isServer && globalThis.process?.env?.MEALIE_READONLY_TOKEN
        ? { Authorization: `Bearer ${globalThis.process?.env?.MEALIE_READONLY_TOKEN}` }
        : undefined,
  })
  configured = true
}

export { client }
