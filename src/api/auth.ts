/**
 * Authentication for the Mealie API.
 *
 * The API token is no longer held client-side. Instead, the nginx reverse
 * proxy (production) or the Vite dev server (development) injects the token
 * as an Authorization: Bearer header on every /api/* request.
 *
 * This module exposes getCurrentUser() which is used by the root route loader
 * to verify the proxy is correctly configured and the token is valid.
 * If the request fails, the user is redirected to the /login error page.
 */

import type { UserOut } from "./generated"
// Import from ./client so the client config is applied before any request.
import { getLoggedInUserApiUsersSelfGet } from "./generated"
import "./client"

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns true when the API proxy appears to be reachable.
 * The actual token validity is checked asynchronously via getCurrentUser().
 * This is used as a fast synchronous guard in the login route.
 */
export function isAuthenticated(): boolean {
  // Without a client-side token we can't determine auth state synchronously.
  // The route loader (getCurrentUser) performs the real check at navigation time.
  // Return true here so the login page is not shown before the loader runs.
  return true
}

/**
 * Fetch the currently authenticated user's profile.
 * Useful for verifying the proxy is working and the token is valid on startup.
 * Throws if the request fails (proxy misconfigured or token invalid).
 */
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
