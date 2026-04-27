/**
 * Authentication for the Mealie API.
 *
 * Uses a long-lived API token generated from your Mealie profile page
 * (Settings → API Tokens). Set it in your .env file:
 *
 *   VITE_MEALIE_API_TOKEN=your-token-here
 *
 * The token is read at module initialisation time and held in memory.
 * The request interceptor in src/api/client.ts attaches it as a Bearer
 * token on every outgoing request.
 */

// Import from ./client (not ./generated) so the auth interceptor is registered
// before any request is made.
import { getLoggedInUserApiUsersSelfGet } from './generated'
import type { UserOut } from './generated'
import './client'

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

let _token: string | null = import.meta.env.VITE_MEALIE_API_TOKEN ?? null

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Returns the current bearer token, or null if not set. */
export function getToken(): string | null {
  return _token
}

/** Returns true if a token is present. */
export function isAuthenticated(): boolean {
  return _token !== null
}

/**
 * Fetch the currently authenticated user's profile.
 * Useful for verifying the token is valid on startup.
 */
export async function getCurrentUser(): Promise<UserOut> {
  const { data, error } = await getLoggedInUserApiUsersSelfGet({
    throwOnError: false,
  })

  if (error || !data) {
    throw new Error('Failed to fetch current user — check your API token')
  }

  return data
}
