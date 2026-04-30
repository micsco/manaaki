import type { UserOut } from "./generated"
import { getLoggedInUserApiUsersSelfGet } from "./generated"
import "./client"

export async function getCurrentUser(): Promise<UserOut> {
  const { data, error } = await getLoggedInUserApiUsersSelfGet({
    throwOnError: false,
  })

  if (error || !data) {
    throw new Error(
      "Failed to fetch current user — check that MEALIE_API_TOKEN and MEALIE_INTERNAL_URL" +
        " are set correctly in the deployment environment."
    )
  }

  return data
}
