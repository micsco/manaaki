import { client } from "./generated/client.gen"
import { retryingFetch } from "./retryingFetch"

const isServer = typeof window === "undefined"

client.setConfig({
  baseUrl: isServer ? (process.env.MEALIE_INTERNAL_URL ?? "") : "",
  fetch: retryingFetch,
  headers:
    isServer && process.env.MEALIE_API_TOKEN
      ? { Authorization: `Bearer ${process.env.MEALIE_API_TOKEN}` }
      : undefined,
})

export { client }
