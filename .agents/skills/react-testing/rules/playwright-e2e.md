---
title: Playwright E2E Testing
impact: HIGH
impactDescription: E2E tests verify complete user flows that unit tests cannot; correct setup prevents flakiness
tags: playwright, e2e, typescript, network-mocking, CI
---

## Playwright E2E Testing

### Use TypeScript Playwright — not Python scripts

This is a TypeScript/React project. Use `@playwright/test` with TypeScript.

The `anthropics/skills webapp-testing` skill uses Python Playwright for ad-hoc
automation scripts. That approach is useful for one-off exploration but is not
appropriate for a maintained test suite in a TypeScript codebase.

| | Python Playwright scripts | `@playwright/test` TypeScript |
|--|--------------------------|-------------------------------|
| Type safety | None | Full TypeScript |
| Test runner | Manual | Built-in (parallel, retries, sharding) |
| Auto-waiting | Manual `wait_for_load_state` | Built-in for every action |
| Assertions | Manual checks | `expect(locator).toBeVisible()` etc. |
| CI integration | Manual | `webServer`, reporters, environment flags |
| Fixtures | None | Typed test fixtures |

---

### `playwright.config.ts`

Place at the project root:

```ts
import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
})
```

`webServer` starts the dev server before any test and shuts it down after.
Locally it reuses an existing server if one is already running. In CI it always
starts fresh.

Add `playwright-report/` and `test-results/` to `.gitignore`.

---

### Locator priority: role first

The same query priority that applies in RTL applies in Playwright. `getByRole`
tests accessible semantics and is far less brittle than CSS selectors.

**Correct:**

```ts
// Role + accessible name
await page.getByRole("button", { name: /cook mode/i }).click()
await expect(page.getByRole("heading", { name: /ingredients/i })).toBeVisible()
await page.getByRole("checkbox", { name: /flour/i }).check()

// Text is fine for non-interactive content
await expect(page.getByText(/1h 30m/)).toBeVisible()

// Label text for form inputs
await page.getByLabel("Search recipes").fill("pasta")
```

**Incorrect:**

```ts
// ❌ CSS selectors break on className or structural changes
await page.locator(".cook-mode-btn").click()
await page.locator("ul.ingredients li:nth-child(2)").click()

// ❌ test IDs pollute production markup
await page.locator('[data-testid="cook-mode-toggle"]').click()
```

Playwright's `getByRole` accepts the same ARIA role names as RTL.

---

### Network mocking with route

For E2E tests that run without a real Mealie instance, intercept API calls
with `page.route` before navigation.

**Recipe list test:**

```ts
test("shows recipe list from API", async ({ page }) => {
  await page.route("/api/recipes*", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          { slug: "pasta-carbonara", name: "Pasta Carbonara", image: null },
          { slug: "risotto", name: "Risotto", image: null },
        ],
        total: 2,
        page: 1,
        per_page: 32,
      }),
    })
  )

  await page.goto("/recipes")
  await expect(page.getByRole("heading", { name: /pasta carbonara/i })).toBeVisible()
  await expect(page.getByRole("heading", { name: /risotto/i })).toBeVisible()
})
```

**Recipe detail test:**

```ts
test("shows recipe detail with ingredients", async ({ page }) => {
  await page.route("/api/recipes/pasta-carbonara", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockRecipeDetail),
    })
  )

  await page.goto("/recipes/pasta-carbonara")
  await expect(page.getByRole("heading", { name: /ingredients/i })).toBeVisible()
})
```

**Cook mode flow test (no API mocking needed for URL state):**

```ts
test("cook mode toggles URL param and layout", async ({ page }) => {
  // Set up API mock so page loads
  await page.route("/api/recipes/pasta-carbonara", route =>
    route.fulfill({ json: mockRecipeDetail })
  )

  await page.goto("/recipes/pasta-carbonara")

  // Activate cook mode
  await page.getByRole("button", { name: /cook mode/i }).click()
  await expect(page).toHaveURL(/\?cook=true/)
  await expect(page.getByRole("button", { name: /exit cook mode/i })).toBeVisible()

  // Deactivate
  await page.getByRole("button", { name: /exit cook mode/i }).click()
  await expect(page).not.toHaveURL(/cook=true/)
  await expect(page.getByRole("button", { name: /cook mode/i })).toBeVisible()
})
```

For tests against a real Mealie instance, skip mocking and guard with an env check:

```ts
test.skip(!process.env.MEALIE_API_TOKEN, "requires real Mealie instance")
```

---

### Assertions and auto-waiting

Playwright auto-waits before every action. For assertions, `expect(locator).*`
also auto-waits. Never use manual polling or `waitForTimeout`.

```ts
// ✅ — toBeVisible auto-waits up to the configured timeout
await expect(page.getByRole("heading", { name: /pasta/i })).toBeVisible()

// ✅ — toHaveURL waits for navigation to complete
await expect(page).toHaveURL("/recipes/pasta-carbonara")

// ✅ — toHaveCount waits for the right number of items
await expect(page.getByRole("listitem")).toHaveCount(5)

// ❌ — manual polling is fragile; use auto-waiting assertions
while (!(await page.isVisible("h1"))) {
  await page.waitForTimeout(100)
}
```

---

### CI integration

Add to `.github/workflows/ci.yml`:

```yaml
- name: Unit tests
  run: pnpm test

- name: Install Playwright browsers
  run: npx playwright install --with-deps chromium

- name: E2E tests
  run: pnpm test:e2e
  env:
    CI: true
```

`CI: true` enables:
- `forbidOnly` — CI fails if `test.only` is committed
- `retries: 2` — retries flaky tests twice before reporting failure
- Fresh `webServer` — doesn't reuse existing server

E2E tests that require `MEALIE_API_TOKEN` are skipped in CI automatically
(the `test.skip` guard). All network-mocked E2E tests always run.
