# React Testing

**Version 1.0.0**
What's Cookin'
May 2026

> **Note:**
> This document is mainly for agents and LLMs to follow when writing or
> reviewing tests in this codebase. Guidance is optimized for automation
> and consistency by AI-assisted workflows.

---

## Abstract

Comprehensive testing guide for React + Vite applications. Covers Vitest and
React Testing Library for unit and component tests, and Playwright for E2E
tests. Rules are adapted from Kent C. Dodds' common mistakes guide, the
official RTL documentation, and Playwright's TypeScript-first best practices.
All patterns are calibrated for this codebase: React 19, TanStack Router,
nuqs URL state, and sessionStorage-backed ingredient/step completion.

---

## Table of Contents

1. [Setup](#1-setup) — **CRITICAL**
   - 1.1 [Install Required Packages](#11-install-required-packages)
   - 1.2 [Vitest Configuration](#12-vitest-configuration)
   - 1.3 [Test Setup File](#13-test-setup-file)
   - 1.4 [Custom Render with Providers](#14-custom-render-with-providers)
   - 1.5 [TypeScript Configuration](#15-typescript-configuration)
   - 1.6 [Package Scripts](#16-package-scripts)
2. [Query Strategy](#2-query-strategy) — **HIGH**
   - 2.1 [Always Use screen](#21-always-use-screen)
   - 2.2 [Query Priority Hierarchy](#22-query-priority-hierarchy)
   - 2.3 [Use ByRole for Almost Everything](#23-use-byrole-for-almost-everything)
   - 2.4 [query* vs get* vs find*](#24-query-vs-get-vs-find)
3. [Interaction](#3-interaction) — **HIGH**
   - 3.1 [Use userEvent Over fireEvent](#31-use-userevent-over-fireevent)
   - 3.2 [Do Not Wrap in act Manually](#32-do-not-wrap-in-act-manually)
   - 3.3 [Async Interaction Patterns](#33-async-interaction-patterns)
4. [Assertions](#4-assertions) — **HIGH**
   - 4.1 [Use jest-dom Matchers](#41-use-jest-dom-matchers)
   - 4.2 [query* Only for Absence](#42-query-only-for-absence)
   - 4.3 [Use find* for Async Elements](#43-use-find-for-async-elements)
   - 4.4 [waitFor Rules](#44-waitfor-rules)
   - 4.5 [Make Assertions Explicit](#45-make-assertions-explicit)
5. [Mocking](#5-mocking) — **HIGH**
   - 5.1 [Mock at the Module Boundary](#51-mock-at-the-module-boundary)
   - 5.2 [Clear Mocks Between Tests](#52-clear-mocks-between-tests)
   - 5.3 [Mock sessionStorage](#53-mock-sessionstorage)
   - 5.4 [Stub Unsupported Browser APIs](#54-stub-unsupported-browser-apis)
   - 5.5 [Mock Context via Custom Render](#55-mock-context-via-custom-render)
6. [Playwright E2E](#6-playwright-e2e) — **HIGH**
   - 6.1 [Use TypeScript Playwright, Not Python](#61-use-typescript-playwright-not-python)
   - 6.2 [Playwright Configuration](#62-playwright-configuration)
   - 6.3 [Locator Priority: Role First](#63-locator-priority-role-first)
   - 6.4 [Network Mocking with route](#64-network-mocking-with-route)
   - 6.5 [Assertions and Waiting](#65-assertions-and-waiting)
   - 6.6 [CI Integration](#66-ci-integration)

---

## 1. Setup

**Impact: CRITICAL**

Correct setup is the foundation. Mistakes here cause every test to be harder to
write and maintain. The custom render wrapper is the most important single
decision.

### 1.1 Install Required Packages

```bash
pnpm add -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
pnpm add -D @playwright/test
npx playwright install chromium
```

Rationale for each package:

| Package | Purpose |
|---------|---------|
| `vitest` | Test runner — Vite-native, shares the same config and transform pipeline |
| `@vitest/coverage-v8` | Coverage via V8's built-in instrumentation; no Babel required |
| `@testing-library/react` | RTL — render components into a real jsdom DOM |
| `@testing-library/user-event` | Realistic browser event sequences (keydown, keyup, change, etc.) |
| `@testing-library/jest-dom` | Custom matchers: `toBeInTheDocument`, `toBeChecked`, `toHaveTextContent`, etc. |
| `jsdom` | DOM environment for Vitest |
| `@playwright/test` | Browser-based E2E testing with TypeScript support built in |

### 1.2 Vitest Configuration

Place in `vitest.config.ts` at the project root, separate from `vite.config.ts`.
This keeps the dev/build config clean and lets Vitest own its own plugin
pipeline.

```ts
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["src/api/generated/**", "node_modules/**", "e2e/**"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/api/generated/**",
        "src/routeTree.gen.ts",
        "src/test/**",
      ],
    },
  },
})
```

Key settings explained:

- `globals: true` — `describe`, `it`, `expect`, `vi`, `beforeEach` etc. are
  available without importing in every file. Add `vitest/globals` to tsconfig
  `types` array.
- `environment: "jsdom"` — runs tests in a simulated browser DOM.
- `setupFiles` — runs before each test file, not before each test.
- `include` — scoped to `src/**`, not `e2e/**` (Playwright handles those).

### 1.3 Test Setup File

`src/test/setup.ts` runs before every test file. Use it to extend `expect` with
jest-dom matchers and to stub browser APIs that jsdom doesn't implement.

```ts
import "@testing-library/jest-dom/vitest"

// navigator.wakeLock is not implemented in jsdom.
// CookModeContext uses it; stub it to prevent errors.
Object.defineProperty(navigator, "wakeLock", {
  value: {
    request: vi.fn().mockResolvedValue({ release: vi.fn() }),
  },
  writable: true,
})

beforeEach(() => {
  // Reset sessionStorage between tests so ingredient/step checkbox
  // state does not leak between test cases.
  sessionStorage.clear()
})
```

Always import `@testing-library/jest-dom/vitest` (not `/jest`) — the `/vitest`
entrypoint registers matchers with Vitest's `expect`.

### 1.4 Custom Render with Providers

This is the most important setup decision. All component tests must render
inside the same provider tree that the app uses. Create a custom `render`
function that wraps every component in the required providers and re-export
everything from `@testing-library/react`.

**File: `src/test/render.tsx`**

```tsx
import { render, type RenderOptions } from "@testing-library/react"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import type { ReactElement } from "react"
import { CookModeProvider } from "../contexts/CookModeContext"

function AllProviders({ children }: { children: React.ReactNode }) {
  return (
    <NuqsTestingAdapter>
      <CookModeProvider>{children}</CookModeProvider>
    </NuqsTestingAdapter>
  )
}

function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  return render(ui, { wrapper: AllProviders, ...options })
}

// Re-export everything so tests only need one import
export * from "@testing-library/react"
export { renderWithProviders as render }
```

All component tests import from `src/test/render`, not from
`@testing-library/react`:

```tsx
// ✅
import { render, screen } from "../test/render"

// ❌ — components may fail because required context is missing
import { render, screen } from "@testing-library/react"
```

Why `NuqsTestingAdapter`: `CookModeProvider` calls `useQueryState` from nuqs,
which requires a router context. In tests there is no real router, so nuqs
provides `NuqsTestingAdapter` specifically for this case. Without it, any
component that touches cook mode state will throw on mount.

### 1.5 TypeScript Configuration

Add `vitest/globals` to the `types` array in `tsconfig.json` so TypeScript
recognises `vi`, `describe`, `it`, `expect`, etc. without explicit imports:

```json
{
  "compilerOptions": {
    "types": ["vite/client", "vitest/globals"]
  }
}
```

### 1.6 Package Scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

---

## 2. Query Strategy

**Impact: HIGH**

Choosing the right query is the difference between tests that give you
confidence and tests that break on every refactor or that miss real bugs.

### 2.1 Always Use screen

`screen` is a global object that queries against the entire rendered document.
Import it alongside `render` and use `screen.*` for every query.

**Incorrect: destructuring from render**

```tsx
const { getByRole, getByText } = render(<MyComponent />)
```

This is legacy Enzyme style. The render return value is not "wrapping" anything;
it is just a bag of utilities. Destructuring forces you to update that
destructure whenever you add or remove queries.

**Correct: use screen**

```tsx
render(<MyComponent />)
screen.getByRole("button", { name: /save/i })
screen.getByText(/ingredients/i)
```

With `screen` you only need the import once. Your editor's autocomplete shows
every available query.

**Debugging:** Use `screen.debug()` to print the current DOM tree.

### 2.2 Query Priority Hierarchy

Use queries in this order. Higher-priority queries test the same things a user
or screen reader would see; lower-priority queries test implementation details.

| Priority | Query | When to use |
|----------|-------|-------------|
| 1 | `*ByRole` | Almost everything — buttons, headings, checkboxes, inputs, lists |
| 2 | `*ByLabelText` | Form inputs associated with a `<label>` |
| 3 | `*ByPlaceholderText` | Inputs with no label (prefer adding a label) |
| 4 | `*ByText` | Non-interactive text content |
| 5 | `*ByDisplayValue` | Current value of a form field |
| 6 | `*ByAltText` | Images |
| 7 | `*ByTitle` | Elements with a `title` attribute |
| 8 | `*ByTestId` | Escape hatch only — requires adding `data-testid` to production markup |

Only use `*ByTestId` when the element has no accessible name, role, or text that
is stable. If you find yourself using it frequently, that is a signal the
component has accessibility problems.

### 2.3 Use ByRole for Almost Everything

`getByRole` matches by the element's ARIA role and optionally its accessible
name. It works even when text is split across child elements.

```tsx
// Fails if text is split across <span>s
screen.getByText(/hello world/i)

// Works regardless of DOM structure
screen.getByRole("button", { name: /hello world/i })
```

Common roles:

| Element | Implicit role |
|---------|--------------|
| `<button>` | `button` |
| `<a href>` | `link` |
| `<input type="text">` | `textbox` |
| `<input type="checkbox">` | `checkbox` |
| `<h1>`–`<h6>` | `heading` |
| `<ul>`, `<ol>` | `list` |
| `<li>` | `listitem` |
| `<img alt="...">` | `img` |
| `<nav>` | `navigation` |

Do not add `role=button` to a `<button>` — it is redundant and confuses screen
readers. Trust implicit roles.

When a query fails, RTL logs all available roles in the error message. Read
that output — it tells you exactly what roles are present.

### 2.4 query* vs get* vs find*

| Variant | Returns | Throws if absent | Use when |
|---------|---------|-----------------|----------|
| `get*` | Element | Yes (immediately) | Element should be in DOM right now |
| `query*` | Element or null | No | Asserting element is NOT in DOM |
| `find*` | Promise<Element> | Yes (after timeout) | Element appears asynchronously |

```tsx
// ✅ — asserting presence (synchronous)
expect(screen.getByRole("alert")).toBeInTheDocument()

// ✅ — asserting absence
expect(screen.queryByRole("alert")).not.toBeInTheDocument()

// ✅ — element appears after async work
const alert = await screen.findByRole("alert")

// ❌ — wrong variant for asserting presence (poor error message)
expect(screen.queryByRole("alert")).toBeInTheDocument()

// ❌ — unnecessary wrapping (find* already does this)
const alert = await waitFor(() => screen.getByRole("alert"))
```

---

## 3. Interaction

**Impact: HIGH**

Tests that simulate realistic user input catch more bugs than tests that
directly set DOM properties.

### 3.1 Use userEvent Over fireEvent

`@testing-library/user-event` fires the full sequence of events a real browser
fires. `fireEvent` fires a single synthetic event.

```tsx
// ❌ — fires only a change event; misses keydown, keypress, keyup
fireEvent.change(input, { target: { value: "flour" } })

// ✅ — fires the full keyboard event sequence
const user = userEvent.setup()
await user.type(input, "flour")
```

Always call `userEvent.setup()` once per test (or in `beforeEach`) and reuse
the instance. This ensures pointer state is consistent across interactions.

```tsx
describe("IngredientCheckbox", () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
  })

  it("toggles on click", async () => {
    render(<IngredientCheckbox ... />)
    await user.click(screen.getByRole("checkbox"))
    expect(screen.getByRole("checkbox")).toBeChecked()
  })
})
```

### 3.2 Do Not Wrap in act Manually

`render` and all `userEvent` methods already wrap their work in `act`. Adding
another `act` around them is redundant and creates noise.

```tsx
// ❌ — act is already called internally by render
act(() => { render(<Counter />) })

// ❌ — act is already called internally by user.click
act(() => { user.click(button) })

// ✅
render(<Counter />)
await user.click(button)
```

If you see an `act(...)` warning, it is telling you that a state update happened
outside a test boundary — usually from an unresolved promise or a timer. Fix the
root cause; do not silence it with `act`.

### 3.3 Async Interaction Patterns

When an interaction triggers async work (network calls, timers, state updates):

```tsx
// Wait for the resulting UI change
await user.click(screen.getByRole("button", { name: /cook mode/i }))
expect(screen.getByRole("button", { name: /exit cook mode/i })).toBeInTheDocument()

// For async state that takes time to appear, use find*
await user.click(submitButton)
const confirmation = await screen.findByRole("status")
expect(confirmation).toHaveTextContent(/saved/i)
```

For components with fake timers, use `vi.useFakeTimers()` + `vi.runAllTimersAsync()`.

---

## 4. Assertions

**Impact: HIGH**

The right assertions give clear error messages. The wrong ones fail with
cryptic output that makes debugging hard.

### 4.1 Use jest-dom Matchers

Always use `@testing-library/jest-dom` matchers. They are more readable and
produce better failure messages than raw DOM property assertions.

```tsx
// ❌ — error message: "expect(false).toBe(true)"
expect(checkbox.checked).toBe(true)

// ✅ — error message: "Received element is not checked: <input type='checkbox' />"
expect(screen.getByRole("checkbox")).toBeChecked()
```

Common matchers:

| Matcher | Use for |
|---------|---------|
| `.toBeInTheDocument()` | Element is in the DOM |
| `.not.toBeInTheDocument()` | Element is absent |
| `.toBeVisible()` | Element is visible (not hidden by CSS) |
| `.toBeChecked()` | Checkbox or radio is checked |
| `.toBeDisabled()` | Button/input is disabled |
| `.toHaveTextContent(/pattern/)` | Text content matches |
| `.toHaveValue("text")` | Form field value |
| `.toHaveAttribute("aria-label", "...")` | Element attribute |
| `.toHaveFocus()` | Element has keyboard focus |

### 4.2 query* Only for Absence

`query*` variants return `null` instead of throwing when no element is found.
That is the **only** reason to use them — to assert something is not there.

```tsx
// ✅ — correct use of query*
expect(screen.queryByRole("alert")).not.toBeInTheDocument()

// ❌ — use get* instead; query* gives a worse error message on failure
expect(screen.queryByRole("alert")).toBeInTheDocument()
```

### 4.3 Use find* for Async Elements

`find*` = `waitFor` + `get*`. It polls until the element appears or the timeout
expires. Always prefer `find*` over `waitFor(() => screen.getBy*(...))`.

```tsx
// ✅
const item = await screen.findByRole("listitem", { name: /pasta/i })

// ❌ — equivalent but more verbose and harder to read
const item = await waitFor(() => screen.getByRole("listitem", { name: /pasta/i }))
```

### 4.4 waitFor Rules

`waitFor` is for waiting until a specific assertion passes. Follow these rules:

**Only one assertion per waitFor callback:**
```tsx
// ❌ — if the second assertion fails, you wait the full timeout before seeing the error
await waitFor(() => {
  expect(fetchMock).toHaveBeenCalledWith("/api/recipes")
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

// ✅ — fail fast on the first assertion; follow up synchronously
await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/recipes"))
expect(fetchMock).toHaveBeenCalledTimes(1)
```

**No side effects inside waitFor:**
```tsx
// ❌ — the click may fire multiple times (waitFor retries the callback)
await waitFor(() => {
  fireEvent.click(button)
  expect(screen.getByRole("dialog")).toBeInTheDocument()
})

// ✅ — side effects outside, assertion inside
await user.click(button)
await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument())
```

**No empty waitFor callbacks:**
```tsx
// ❌ — fragile; relies on timing rather than a real condition
await waitFor(() => {})
expect(fetchMock).toHaveBeenCalled()

// ✅ — waits for the real condition
await waitFor(() => expect(fetchMock).toHaveBeenCalled())
```

### 4.5 Make Assertions Explicit

`get*` throws on failure, which provides a useful error message. But calling it
without an assertion leaves intent ambiguous. Make the assertion explicit so it
reads as a deliberate check.

```tsx
// ✅ — intent is clear
expect(screen.getByRole("heading", { name: /ingredients/i })).toBeInTheDocument()

// also acceptable — get* will throw with a useful message if absent
screen.getByRole("heading", { name: /ingredients/i })
```

Do not leave bare `getBy*` calls without any assertion in tests that are checking
for presence — it reads as if the query is leftover from a refactor.

---

## 5. Mocking

**Impact: HIGH**

Good mocking isolates the unit under test without coupling to internal
implementation details.

### 5.1 Mock at the Module Boundary

Mock at the outermost layer the component depends on — the module export, not the
implementation detail inside it.

```ts
// ✅ — mock the API module boundary
vi.mock("../api/client", () => ({
  getAllApiRecipesGet: vi.fn().mockResolvedValue({
    data: { items: [{ slug: "pasta", name: "Pasta" }], total: 1 },
  }),
}))

// ❌ — mocking fetch directly is fragile and reaches past the boundary
vi.spyOn(global, "fetch").mockResolvedValue(...)
```

For components that don't call the API directly (loaders do), you typically
don't need API mocks at the component level at all. Only mock what the component
actually calls.

### 5.2 Clear Mocks Between Tests

Always reset mock state in `beforeEach` to prevent test pollution.

```ts
beforeEach(() => {
  vi.clearAllMocks()   // Reset call counts, return values, implementations
  sessionStorage.clear() // Ingredient/step checkbox state must not leak
})
```

Use `vi.clearAllMocks()` (not `vi.resetAllMocks()` or `vi.restoreAllMocks()`
unless you specifically need those — they have different semantics).

### 5.3 Mock sessionStorage

jsdom provides a working `sessionStorage` implementation. The `useSessionStorage`
hook works in tests without any additional mocking. Call `sessionStorage.clear()`
in `beforeEach` (already done in `src/test/setup.ts`) and the hook behaves
exactly as it does in the browser.

To test that a value was persisted:

```ts
it("persists checked state to sessionStorage", async () => {
  const user = userEvent.setup()
  render(<IngredientCheckbox recipeId="abc" ingredientIndex={0} ingredient="flour" />)

  await user.click(screen.getByRole("checkbox"))

  expect(sessionStorage.getItem("recipe-abc-ingredient-0")).toBe("true")
})
```

### 5.4 Stub Unsupported Browser APIs

jsdom does not implement every browser API. Stub missing APIs in
`src/test/setup.ts` so they don't throw:

```ts
// navigator.wakeLock — used by CookModeProvider in cook mode
Object.defineProperty(navigator, "wakeLock", {
  value: {
    request: vi.fn().mockResolvedValue({ release: vi.fn() }),
  },
  writable: true,
})
```

Pattern for adding a new stub:
1. Identify the API (from the error message or source code)
2. Add a minimal stub in `src/test/setup.ts` using `Object.defineProperty`
3. Use `vi.fn()` so tests can assert the stub was called if needed

### 5.5 Mock Context via Custom Render

The `renderWithProviders` function in `src/test/render.tsx` wraps every
component in `NuqsTestingAdapter` + `CookModeProvider`. To test components in
different states (e.g. cook mode active), manipulate state through the real
provider rather than mocking the context:

```tsx
// ✅ — use the real context, trigger via user interaction
it("shows exit button in cook mode", async () => {
  const user = userEvent.setup()
  render(<CookModeToggle />)

  await user.click(screen.getByRole("button", { name: /cook mode/i }))
  expect(screen.getByRole("button", { name: /exit cook mode/i })).toBeInTheDocument()
})

// Also acceptable — set initial URL search params via NuqsTestingAdapter
import { render } from "../test/render"
render(<IngredientsSection ingredients={[...]} recipeId="abc" />, {
  // NuqsTestingAdapter accepts initial search params
  wrapper: ({ children }) => (
    <NuqsTestingAdapter searchParams={{ cook: "true" }}>
      <CookModeProvider>{children}</CookModeProvider>
    </NuqsTestingAdapter>
  ),
})
```

For components that must be tested with a specific cook mode state, pass
`searchParams` to `NuqsTestingAdapter` in a custom wrapper.

---

## 6. Playwright E2E

**Impact: HIGH**

Playwright E2E tests verify complete user flows against the running application.
They complement, not replace, unit and component tests.

### 6.1 Use TypeScript Playwright, Not Python

This is a TypeScript/React project. Use `@playwright/test` with TypeScript.
The `anthropics/skills webapp-testing` skill uses Python Playwright for ad-hoc
automation scripts — that approach is useful for one-off exploration but not
for a maintained test suite. The differences:

| | Python Playwright scripts | `@playwright/test` TypeScript |
|--|--------------------------|-------------------------------|
| Type safety | None | Full TypeScript |
| Test runner integration | Manual | Built-in (parallel, sharding, retries) |
| Auto-waiting | Manual `wait_for_load_state` | Built-in for every action |
| Assertions | Custom | `expect(locator).toBeVisible()` etc. |
| CI integration | Manual | `webServer`, `--reporter` flags |
| Fixtures | None | Typed test fixtures |

### 6.2 Playwright Configuration

**`playwright.config.ts`** at the project root:

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

`webServer` starts `pnpm dev` automatically before the tests run and shuts it
down after. In CI this is always a fresh start; locally it reuses an existing
dev server if one is already running.

### 6.3 Locator Priority: Role First

The same query priority that applies in RTL applies in Playwright. Prefer
`getByRole` — it tests accessible semantics, is less brittle than CSS selectors,
and doubles as an accessibility audit.

```ts
// ✅ — role-based, mirrors how users and screen readers navigate
await page.getByRole("button", { name: /cook mode/i }).click()
await expect(page.getByRole("heading", { name: /ingredients/i })).toBeVisible()
await page.getByRole("checkbox", { name: /flour/i }).check()

// ✅ — text is also fine for non-interactive content
await expect(page.getByText(/1h 30m/)).toBeVisible()

// ❌ — CSS selectors are brittle, break on className changes
await page.locator(".cook-mode-btn").click()
await page.locator("li.ingredient:nth-child(2)").click()

// ❌ — test IDs require polluting production markup
await page.locator('[data-testid="cook-mode-toggle"]').click()
```

Playwright's `getByRole` accepts the same role names as RTL.

### 6.4 Network Mocking with route

For E2E tests that should run without a real Mealie instance, intercept API
calls with `page.route`:

```ts
test("shows recipe list", async ({ page }) => {
  await page.route("/api/recipes*", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          { slug: "pasta-carbonara", name: "Pasta Carbonara" },
          { slug: "risotto", name: "Risotto" },
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

Pattern:
1. Register `page.route` before navigation
2. Navigate with `page.goto`
3. Assert against what the component renders given the mocked response

For tests that need to run against a real Mealie instance (smoke tests),
skip mocking and rely on `MEALIE_API_TOKEN` / `MEALIE_INTERNAL_URL` in `.env`.
Guard these with an environment check:

```ts
test.skip(!process.env.MEALIE_API_TOKEN, "requires real Mealie instance")
```

### 6.5 Assertions and Waiting

Playwright auto-waits for elements before every action. For explicit
assertions, use `expect(locator).*` — these also auto-wait.

```ts
// ✅ — toBeVisible auto-waits up to the configured timeout
await expect(page.getByRole("heading", { name: /pasta/i })).toBeVisible()

// ✅ — toHaveURL waits for navigation to complete
await expect(page).toHaveURL("/recipes/pasta-carbonara")

// ❌ — polling manually is fragile; use auto-waiting assertions instead
while (!(await page.isVisible("h1"))) {
  await page.waitForTimeout(100)
}
```

For URL state (cook mode uses `?cook=true`):
```ts
await page.getByRole("button", { name: /cook mode/i }).click()
await expect(page).toHaveURL(/\?cook=true/)

await page.getByRole("button", { name: /exit cook mode/i }).click()
await expect(page).toHaveURL(/\/recipes\//)  // cook param cleared
```

### 6.6 CI Integration

Add to `.github/workflows/ci.yml`:

```yaml
- name: Unit tests
  run: pnpm test

- name: E2E tests
  run: pnpm test:e2e
  env:
    CI: true
  # E2E tests that require a real Mealie instance are skipped in CI
  # because MEALIE_API_TOKEN is not available. Mocked E2E tests always run.
```

Playwright's `CI: true` environment variable:
- Enables `forbidOnly` (prevents accidental `test.only` in CI)
- Enables retries (2 retries on failure before reporting)
- Uses fresh `webServer` (doesn't reuse existing)

The HTML reporter writes to `playwright-report/`. Add it to `.gitignore`.

---

## Writing Tests: What to Test Where

| Code | Test type | Why |
|------|-----------|-----|
| `src/utils/recipe.ts` — `formatTime`, `formatQuantity`, `recipeImageUrl` | Unit (Vitest) | Pure functions, no DOM needed |
| `src/hooks/useSessionStorage.ts` | Hook (Vitest + renderHook) | Tests real storage behaviour |
| `src/components/ui/Badge`, `Button` | Component (RTL) | Render + variant classes + interaction |
| `src/components/IngredientCheckbox` | Component (RTL) | Toggle, storage persistence, keyboard |
| `src/components/IngredientsSection` | Component (RTL) | Cook mode vs normal layout |
| `src/components/CookModeToggle` | Component (RTL) | Context interaction, URL param |
| Recipe list page flow | E2E (Playwright) | Navigation, real render pipeline |
| Cook mode toggle flow | E2E (Playwright) | URL state, visual layout change |

Keep test files co-located with the source:
- `src/utils/recipe.test.ts`
- `src/hooks/useSessionStorage.test.ts`
- `src/components/IngredientCheckbox.test.tsx`
- `e2e/recipes.spec.ts`
- `e2e/cook-mode.spec.ts`

---

## What Not to Test

- Tailwind class names — test behaviour and accessibility, not CSS
- Implementation details — don't assert on internal state or private refs
- Third-party library internals — trust that `@tanstack/react-router` works
- Generated API types — they're generated, not authored
