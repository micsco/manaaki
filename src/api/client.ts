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
    headers:
      isServer && globalThis.process?.env?.MEALIE_API_TOKEN
        ? { Authorization: `Bearer ${globalThis.process?.env?.MEALIE_API_TOKEN}` }
        : undefined,
  })
  configured = true
}

export { client }
