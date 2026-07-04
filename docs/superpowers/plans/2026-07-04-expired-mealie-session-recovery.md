# Expired Mealie Session Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recover public recipe browsing from expired Mealie sessions, reject expired private sessions cleanly, and render actionable recipe-loading failures.

**Architecture:** The Node BFF remains the session authority. It classifies proactive refresh results, clears invalid sessions, retries only anonymous-allowed requests with the read-only token, and leaves transient refresh failures alone while the access token is still valid. Current-user resolution validates the user before reporting authentication, while the recipe query carries HTTP status into a retry policy and accessible error UI.

**Tech Stack:** TypeScript 6, TanStack Start, TanStack Query 5, React 19, Vitest, React Testing Library

---

### Task 1: Recover invalid sessions in the BFF

**Files:**
- Modify: `src/server/proxy.test.ts`
- Modify: `src/server/proxy.ts`

- [ ] **Step 1: Write failing proxy tests**

Add helpers for expired and near-expiry JWTs plus request-aware upstream responses. Add tests asserting:

```ts
it("falls back to the read-only token for an expired public session", async () => {
  setNextResponse({ status: 200, body: "[]" })

  const response = await handleApiProxy(
    new Request("https://app/api/recipes", {
      headers: {
        host: "manaaki.micsco.nz",
        "x-forwarded-proto": "https",
        cookie: sessionCookieHeader(expiredJwt()),
      },
    })
  )

  expect(response.status).toBe(200)
  expect(lastUpstreamRequest?.headers.authorization).toBe("Bearer ro-token")
  expect(response.headers.get("set-cookie")).toContain("Max-Age=0")
})

it("rejects a private request when refresh reports an invalid session", async () => {
  setPathResponse("/api/auth/refresh", { status: 401 })

  const response = await handleApiProxy(
    new Request("https://app/api/households/mealplans", {
      headers: {
        host: "manaaki.micsco.nz",
        "x-forwarded-proto": "https",
        cookie: sessionCookieHeader(nearExpiryJwt()),
      },
    })
  )

  expect(response.status).toBe(401)
  expect(response.headers.get("set-cookie")).toContain("Max-Age=0")
})

it("retries a public request with the read-only token after an upstream 401", async () => {
  setResponseFactory(request =>
    request.headers.authorization === "Bearer ro-token"
      ? { status: 200, body: "[]" }
      : { status: 401 }
  )

  const response = await handleApiProxy(
    new Request("https://app/api/recipes", {
      headers: {
        host: "manaaki.micsco.nz",
        "x-forwarded-proto": "https",
        cookie: sessionCookieHeader(farFutureJwt()),
      },
    })
  )

  expect(response.status).toBe(200)
  expect(lastUpstreamRequest?.headers.authorization).toBe("Bearer ro-token")
  expect(response.headers.get("set-cookie")).toContain("Max-Age=0")
})
```

Add the corresponding private forwarded-401 test and a transient refresh failure test that still forwards the existing valid token.

- [ ] **Step 2: Run proxy tests and verify the new tests fail**

Run:

```bash
CI=1 ./node_modules/.bin/vitest run src/server/proxy.test.ts
```

Expected: failures showing expired sessions still forward the user token, refresh 401 still forwards the user token, forwarded 401 is returned without fallback, and no clearing cookie is set.

- [ ] **Step 3: Implement classified refresh and invalid-session recovery**

In `src/server/proxy.ts`, import `buildClearSessionCookie` and replace the nullable refresh result with:

```ts
type SessionToken =
  | { state: "valid"; token: string }
  | { state: "refreshed"; token: string }
  | { state: "invalid" }
```

Classify a decoded token whose `exp` is at or before the current time as invalid. For a valid near-expiry token, classify refresh 401 as invalid, refresh success as refreshed, and network or 5xx refresh failure as valid with the original token.

Add a recovery function that returns a read-only forwarded response for `isAnonymousAllowed(...)` and otherwise returns 401. Both branches append `buildClearSessionCookie(...)` and set `Cache-Control: private, no-store`.

After forwarding a user-token request, invoke the same recovery when Mealie returns 401. Preserve the existing refreshed-cookie and private-cache behaviour for successful authenticated responses.

- [ ] **Step 4: Run proxy tests and verify they pass**

Run:

```bash
CI=1 ./node_modules/.bin/vitest run src/server/proxy.test.ts
```

Expected: all proxy tests pass.

### Task 2: Validate current-user identity

**Files:**
- Create: `src/server/currentUser.test.ts`
- Modify: `src/server/currentUser.ts`

- [ ] **Step 1: Write failing current-user tests**

Mock the generated SDK boundary and Mealie client factory. Use real session sealing to cover:

```ts
it("reports a validated session as authenticated", async () => {
  mockGetLoggedInUser.mockResolvedValueOnce({ data: authenticatedUser } as never)

  await expect(resolveCurrentUser(requestWithSession(userJwt))).resolves.toEqual({
    user: authenticatedUser,
    isAnonymous: false,
  })
})

it("falls back to the read-only identity when the session is invalid", async () => {
  mockGetLoggedInUser
    .mockResolvedValueOnce({
      data: undefined,
      response: new Response(null, { status: 401 }),
    } as never)
    .mockResolvedValueOnce({ data: readOnlyUser } as never)

  await expect(resolveCurrentUser(requestWithSession(userJwt))).resolves.toEqual({
    user: readOnlyUser,
    isAnonymous: true,
  })
  expect(mockCreateMealieClient).toHaveBeenNthCalledWith(2, "ro-token")
})
```

Add a transient-503 test asserting that identity resolution rejects instead of returning an anonymous identity.

- [ ] **Step 2: Run the current-user tests and verify the invalid-session test fails**

Run:

```bash
CI=1 ./node_modules/.bin/vitest run src/server/currentUser.test.ts
```

Expected: the invalid-session test receives `{ user: null, isAnonymous: false }`.

- [ ] **Step 3: Implement validated identity resolution**

When a session token exists, request `/api/users/self` with it. Return authenticated state only when data exists. On 401, create a read-only client, request the same endpoint, and return its data with `isAnonymous: true`. Propagate network and 5xx failures. Anonymous requests use only the read-only client.

- [ ] **Step 4: Run current-user and existing auth tests**

Run:

```bash
CI=1 ./node_modules/.bin/vitest run src/server/currentUser.test.ts src/routes/-api.auth.me.handler.test.ts src/components/UserMenu.test.tsx
```

Expected: all selected tests pass.

### Task 3: Preserve recipe failure status and control retries

**Files:**
- Modify: `src/hooks/useRecipeList.test.ts`
- Modify: `src/hooks/useRecipeList.ts`

- [ ] **Step 1: Write failing retry-policy tests**

Add tests for a status-bearing error and retry predicate:

```ts
it("does not retry unauthorized recipe requests", () => {
  expect(shouldRetryRecipeList(0, new RecipeListError(401))).toBe(false)
})

it("retries transient recipe failures up to three times", () => {
  expect(shouldRetryRecipeList(0, new RecipeListError(503))).toBe(true)
  expect(shouldRetryRecipeList(2, new RecipeListError(503))).toBe(true)
  expect(shouldRetryRecipeList(3, new RecipeListError(503))).toBe(false)
})
```

Add a query test asserting that an SDK response without data throws `RecipeListError` containing `response.status`.

- [ ] **Step 2: Run hook tests and verify they fail**

Run:

```bash
CI=1 ./node_modules/.bin/vitest run src/hooks/useRecipeList.test.ts
```

Expected: `RecipeListError` and `shouldRetryRecipeList` are missing.

- [ ] **Step 3: Implement the recipe error and retry policy**

Add:

```ts
export class RecipeListError extends Error {
  constructor(readonly status?: number) {
    super("Failed to load recipes")
  }
}

export function shouldRetryRecipeList(failureCount: number, error: unknown): boolean {
  return !(error instanceof RecipeListError && error.status === 401) && failureCount < 3
}
```

Throw `RecipeListError(response.response?.status)` when data is absent and assign `retry: shouldRetryRecipeList` to `recipeListQueryOptions`.

- [ ] **Step 4: Run hook tests and verify they pass**

Run:

```bash
CI=1 ./node_modules/.bin/vitest run src/hooks/useRecipeList.test.ts
```

Expected: all hook tests pass.

### Task 4: Render and recover from recipe-loading errors

**Files:**
- Modify: `src/routes/-recipes.index.test.tsx`
- Modify: `src/routes/recipes.index.tsx`

- [ ] **Step 1: Write failing component tests**

Add:

```tsx
it("shows an actionable error when recipes fail to load", async () => {
  mockGetAll.mockResolvedValue({
    data: undefined,
    response: new Response(null, { status: 503 }),
  } as never)

  render(<RecipeListWrapper />)

  expect(await screen.findByRole("alert")).toHaveTextContent(/unable to load recipes/i)
  expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument()
})

it("loads recipes after retrying a failed request", async () => {
  const user = userEvent.setup()
  mockGetAll
    .mockResolvedValueOnce({
      data: undefined,
      response: new Response(null, { status: 503 }),
    } as never)
    .mockResolvedValueOnce({
      data: { items: [baseRecipe], total_pages: 1 },
    } as never)

  render(<RecipeListWrapper />)
  await user.click(await screen.findByRole("button", { name: /try again/i }))

  expect(await screen.findByRole("heading", { name: /banana bread/i })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the route test and verify the new tests fail**

Run:

```bash
CI=1 ./node_modules/.bin/vitest run src/routes/-recipes.index.test.tsx
```

Expected: no alert or retry button is rendered.

- [ ] **Step 3: Implement the recipe error state**

Read `isError`, `isFetching`, and `refetch` from `useQuery`. Between the loading and recipe-grid branches render:

```tsx
<div role="alert" className="flex flex-col items-center gap-4 py-20 text-center">
  <p className="text-gray-300 text-lg">Unable to load recipes.</p>
  <button
    type="button"
    disabled={isFetching}
    onClick={() => void refetch()}
    className="rounded-lg bg-orange-600 px-4 py-2 font-medium text-sm text-white disabled:opacity-50"
  >
    {isFetching ? "Trying again…" : "Try again"}
  </button>
</div>
```

- [ ] **Step 4: Run the route tests and verify they pass**

Run:

```bash
CI=1 ./node_modules/.bin/vitest run src/routes/-recipes.index.test.tsx
```

Expected: all route tests pass.

### Task 5: Full validation

**Files:**
- Verify all modified files

- [ ] **Step 1: Format and lint**

Run:

```bash
pnpm check:fix
```

Expected: exit 0.

- [ ] **Step 2: Type-check**

Run:

```bash
pnpm type-check
```

Expected: exit 0.

- [ ] **Step 3: Run all unit tests**

Run:

```bash
pnpm test
```

Expected: exit 0 with no failed tests.

- [ ] **Step 4: Build**

Run:

```bash
pnpm build
```

Expected: exit 0.

- [ ] **Step 5: Inspect the final diff**

Run:

```bash
git diff --check
git status --short
git diff --stat
```

Expected: no whitespace errors and only the approved session-recovery, identity, recipe error, test, design, and plan files are changed.
