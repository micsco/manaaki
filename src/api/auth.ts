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

// ---------------------------------------------------------------------------
// OAuth / OIDC redirect flow
// ---------------------------------------------------------------------------

/**
 * Initiate the OAuth login flow.
 *
 * Redirects the browser to the Mealie server's `/api/auth/oauth` endpoint,
 * which in turn redirects to the configured IdP (e.g. Google). After the user
 * authenticates, the IdP redirects back to Mealie, which then redirects the
 * browser to `/login` with `?code=...&state=...` query params.
 *
 * Call this in response to a "Sign in with OAuth" button click.
 */
export function oauthRedirect(): void {
  const baseUrl = import.meta.env.VITE_MEALIE_BASE_URL ?? 'http://localhost:9000'
  window.location.href = `${baseUrl}/api/auth/oauth`
}

/**
 * Complete the OAuth login flow.
 *
 * Should be called when the app loads on the `/login` page and the URL
 * contains `?code=...&state=...` query params — indicating a redirect back
 * from the IdP via Mealie.
 *
 * Forwards the raw query string to Mealie's `/api/auth/oauth/callback` endpoint,
 * which exchanges the code for a Mealie bearer token and returns it.
 *
 * @param searchParams - The URLSearchParams from the current location
 * @returns The authenticated user, or null if the params were not an OAuth callback
 */
export async function handleOauthCallback(
  searchParams: URLSearchParams,
): Promise<UserOut | null> {
  if (!searchParams.has('code') || !searchParams.has('state')) {
    return null
  }

  // Forward all query params to Mealie's callback endpoint.
  // The generated SDK type declares query?: never because the OpenAPI spec doesn't
  // describe these params — they are forwarded transparently by Mealie from the IdP.
  // We use native fetch here to avoid fighting the generated SDK's type constraints.
  const baseUrl = import.meta.env.VITE_MEALIE_BASE_URL ?? 'http://localhost:9000'
  const response = await fetch(
    `${baseUrl}/api/auth/oauth/callback?${searchParams.toString()}`,
  )

  if (!response.ok) {
    throw new Error('OAuth callback failed: Mealie rejected the authorization code')
  }

  const tokenData = (await response.json()) as TokenResponse
  _token = tokenData.access_token

  return getCurrentUser()
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
