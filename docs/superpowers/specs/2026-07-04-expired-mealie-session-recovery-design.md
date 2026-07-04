# Expired Mealie Session Recovery

## Problem

Manaaki stores a Mealie access token in an encrypted HttpOnly cookie for fourteen days. Mealie access tokens normally expire sooner and `/api/auth/refresh` only accepts a token that is still valid. If a user returns after the Mealie token expires, refresh fails, but Manaaki continues forwarding the expired token.

This breaks public recipe requests even though the read-only token is valid. It also leaves the interface showing authenticated navigation because authentication state is derived from cookie presence rather than successful user validation.

## Desired Behaviour

- A valid user token continues to authorize all requests.
- A near-expiry valid token is refreshed and replaces the session cookie.
- An expired or otherwise invalid user token is removed from the browser.
- An anonymous-allowed request with an invalid session is retried once with the read-only token.
- A private request with an invalid session returns `401 Unauthorized` and clears the session.
- Current-user resolution reports an anonymous user when the session token cannot retrieve `/api/users/self`.
- Recipe loading failures show an actionable error state rather than skeletons followed by an empty list.
- Authentication failures are not repeatedly retried by React Query.

## Server Design

The API proxy remains the central authority for session recovery.

For requests containing a session token:

1. Attempt proactive refresh when the token is within the existing refresh window.
2. If refresh succeeds, forward with the refreshed token and replace the session cookie.
3. If the token is expired or refresh rejects it with 401, treat the session as invalid without forwarding the known-invalid token.
4. If the request is anonymous-allowed, forward once with the read-only token and clear the session cookie on the response.
5. Otherwise return `401 Unauthorized` with a cookie-clearing header.
6. If a token appears valid but the forwarded request returns 401, apply the same invalid-session recovery. This handles revocation, signing-secret changes, deleted users, and malformed tokens that cannot be identified only from `exp`.

The retry is restricted to the existing anonymous allowlist. Private endpoints never fall back to the read-only token.

Network and 5xx refresh failures do not invalidate a token that has not expired. The proxy forwards with the existing token so a transient Mealie outage does not force reauthentication.

## Identity Design

`resolveCurrentUser` will only report an authenticated identity when the user-token request returns user data. If Mealie rejects a session token with 401, it will resolve the read-only user as anonymous so route guards and navigation reflect the actual authorization state. Transient lookup failures are propagated rather than misclassified as anonymous sessions.

No browser-readable token or new client-side credential storage is introduced.

## Recipe Error Handling

Recipe query failures will retain enough status information to distinguish authentication failures from transient failures. Authentication failures will not use React Query's default retries.

The recipe page will render an accessible alert containing a concise failure message and a retry button. Retrying invokes the query again. Existing loading and success states remain unchanged.

## Testing

Proxy tests will cover:

- expired token plus failed refresh on a public endpoint falls back to the read-only token;
- expired token plus failed refresh on a private endpoint returns 401;
- both responses clear the session cookie;
- a forwarded 401 receives the same public/private handling;
- successful proactive refresh remains unchanged.

Current-user tests will cover:

- valid session resolves authenticated user;
- invalid session resolves anonymous identity using the read-only token.
- transient Mealie failure does not resolve as anonymous.

Recipe tests will cover:

- authentication failures are not retried;
- transient failures retain the intended retry policy;
- failed loading renders an alert and retry control;
- retrying can transition the page to recipe content.

## Scope

This change does not add a separate refresh token, alter Mealie, or attempt to preserve authenticated sessions after the Mealie access token has expired. Reauthentication remains required for private features after expiry.
