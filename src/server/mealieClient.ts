import { createClient, createConfig } from "../api/generated/client"
import { retryingFetch } from "../api/retryingFetch"
import { mealieInternalUrl } from "./env"

export function createMealieClient(token: string) {
  return createClient(
    createConfig({
      baseUrl: mealieInternalUrl(),
      fetch: retryingFetch,
      headers: { Authorization: `Bearer ${token}` },
    })
  )
}
