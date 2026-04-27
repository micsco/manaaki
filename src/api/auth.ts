/**
 * In-memory authentication store for the Mealie API.
 *
 * Tokens are held in module-level variables and are intentionally NOT persisted
 * to localStorage or sessionStorage — this avoids XSS token theft. The
 * trade-off is that a page refresh requires the user to log in again. A
 * "remember me" persistence layer can be added in a future iteration.
 *
 * The `getToken()` export is consumed by the request interceptor in
 * src/api/client.ts, which attaches the bearer token to every outgoing request.
 */

import {
  getTokenApiAuthTokenPost,
  logoutApiAuthLogoutPost,
  refreshTokenApiAuthRefreshGet,
  getLoggedInUserApiUsersSelfGet,
} from './generated'
import type { UserOut } from './generated'

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

/** The Mealie auth token response shape (not declared in the OpenAPI spec). */
interface TokenResponse {
  access_token: string
  token_type: string
}

let _token: string | null = null

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Returns the current in-memory bearer token, or null if not authenticated. */
export function getToken(): string | null {
  return _token
}

/** Returns true if there is an active token in memory. */
export function isAuthenticated(): boolean {
  return _token !== null
}

/**
 * Log in with username + password.
 * Stores the returned bearer token in memory and returns the current user.
 */
export async function login(
  username: string,
  password: string,
): Promise<UserOut> {
  const { data, error } = await getTokenApiAuthTokenPost({
    body: { username, password },
    throwOnError: false,
  })

  if (error || !data) {
    throw new Error('Login failed: invalid credentials or server error')
  }

  const tokenData = data as TokenResponse
  _token = tokenData.access_token

  return getCurrentUser()
}

/**
 * Refresh the current token using the /api/auth/refresh endpoint.
 * Must already be authenticated.
 */
export async function refreshToken(): Promise<void> {
  if (!_token) throw new Error('Cannot refresh: not authenticated')

  const { data, error } = await refreshTokenApiAuthRefreshGet({
    throwOnError: false,
  })

  if (error || !data) {
    _token = null
    throw new Error('Token refresh failed')
  }

  const tokenData = data as TokenResponse
  _token = tokenData.access_token
}

/**
 * Log out the current user.
 * Calls the server logout endpoint and clears the in-memory token.
 */
export async function logout(): Promise<void> {
  if (_token) {
    // Best-effort server-side logout; clear token regardless of outcome
    await logoutApiAuthLogoutPost({ throwOnError: false }).catch(() => undefined)
  }
  _token = null
}

/**
 * Fetch the currently authenticated user's profile.
 */
export async function getCurrentUser(): Promise<UserOut> {
  const { data, error } = await getLoggedInUserApiUsersSelfGet({
    throwOnError: false,
  })

  if (error || !data) {
    throw new Error('Failed to fetch current user')
  }

  return data
}
