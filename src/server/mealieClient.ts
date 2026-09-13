import { createClient, createConfig } from "../api/generated/client"
import { timedFetch } from "../api/timedFetch"
import { mealieInternalUrl } from "./env"

export function createMealieClient(token: string) {
  return createClient(
    createConfig({
      baseUrl: mealieInternalUrl(),
      fetch: timedFetch,
      headers: { Authorization: `Bearer ${token}` },
    })
  )
}
