---
name: react-testing
description: Testing strategy for React + Vite apps using Vitest, React Testing Library, and Playwright. Use when writing unit tests, component render tests, hook tests, or E2E tests. Covers query strategy, user interaction patterns, mocking, and Playwright E2E with TypeScript. Adapted from Kent C. Dodds' RTL best practices and the official Testing Library docs.
license: MIT
metadata:
  author: manaaki
  version: "1.0.0"
---

# React Testing

Two-layer testing strategy: **Vitest + React Testing Library** for unit and component tests, **Playwright** for E2E flows against the running app. All rules are adapted from Kent C. Dodds' common mistakes guide, the official RTL docs, and Playwright's TypeScript-first best practices.

## When to Load This Skill

Load this skill when:
- Setting up or configuring the test suite (Vitest, RTL, Playwright)
- Writing unit tests for utilities or pure functions
- Writing hook tests with `renderHook`
- Writing component render or interaction tests
- Writing Playwright E2E specs
- Reviewing or refactoring existing tests
- Debugging failing tests or `act(...)` warnings

---

## Two-Layer Architecture

| Layer | Tool | Scope | File pattern |
|-------|------|-------|--------------|
| Unit / component | Vitest + RTL | Pure functions, hooks, components in isolation | `src/**/*.test.{ts,tsx}` |
| E2E | Playwright | Full user flows against running app | `e2e/**/*.spec.ts` |

Never use Playwright for unit-level assertions. Never use RTL for full navigation flows.

---

## Section Quick Reference

| # | Section | Key rule |
|---|---------|----------|
| 1 | [Setup](#1-setup) | Custom `renderWithProviders` wrapping all required context |
| 2 | [Queries](#2-query-strategy) | `*ByRole` first; always use `screen.*`; never destructure from `render` |
| 3 | [Interaction](#3-interaction) | `userEvent` over `fireEvent`; don't wrap in `act` manually |
| 4 | [Assertions](#4-assertions) | Use `jest-dom` matchers; `query*` only for absence; `find*` for async |
| 5 | [Mocking](#5-mocking) | Mock at the boundary; use `vi.fn` + `vi.mock`; clear in `beforeEach` |
| 6 | [Playwright E2E](#6-playwright-e2e) | `page.getByRole` first; `webServer` in config; network mock with `route` |

---

## 1. Setup

### Required packages

```bash
pnpm add -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
pnpm add -D @playwright/test
npx playwright install chromium
```

### `vitest.config.ts`

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
    exclude: ["src/api/generated/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/api/generated/**", "src/routeTree.gen.ts", "src/test/**"],
    },
  },
})
```

### `src/test/setup.ts`

```ts
import "@testing-library/jest-dom/vitest"

// Stub browser APIs unavailable in jsdom
Object.defineProperty(navigator, "wakeLock", {
  value: { request: vi.fn().mockResolvedValue({ release: vi.fn() }) },
  writable: true,
})

beforeEach(() => {
  sessionStorage.clear()
})
```

### `src/test/render.tsx` — custom render with providers

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

export * from "@testing-library/react"
export { renderWithProviders as render }
```

All component tests import `render` from `src/test/render` — not from `@testing-library/react` directly.

---

## 2. Query Strategy

Query priority (highest confidence → lowest):

1. `getByRole` — accessible role + name. Use for almost everything.
2. `getByLabelText` — form inputs.
3. `getByPlaceholderText` — only when no label.
4. `getByText` — non-interactive text content.
5. `getByDisplayValue` — current value of form element.
6. `getByAltText` — images.
7. `getByTitle` — last resort before testId.
8. `getByTestId` — escape hatch only. Requires explicit `data-testid` attribute.

Always use `screen.*`. Never destructure from `render`.

```tsx
// ✅
render(<Button>Save</Button>)
screen.getByRole("button", { name: /save/i })

// ❌
const { getByRole } = render(<Button>Save</Button>)
```

---

## 3. Interaction

Use `@testing-library/user-event` for all interactions. It fires real browser event sequences.

```tsx
const user = userEvent.setup()
await user.click(screen.getByRole("button", { name: /cook mode/i }))
await user.type(screen.getByRole("textbox"), "flour")
```

Don't wrap `render` or `userEvent` calls in `act` — they already handle it internally.

---

## 4. Assertions

Use `@testing-library/jest-dom` matchers — they give far better error messages than raw DOM property checks.

```tsx
// ✅
expect(screen.getByRole("checkbox")).toBeChecked()
expect(screen.getByRole("button")).toBeDisabled()
expect(screen.getByText(/saved/i)).toBeInTheDocument()

// ❌
expect(checkbox.checked).toBe(true)
expect(button.disabled).toBe(true)
```

`query*` variants are **only** for asserting absence:
```tsx
expect(screen.queryByRole("alert")).not.toBeInTheDocument()
```

For async content use `find*` (not `waitFor(() => getBy*)`):
```tsx
const alert = await screen.findByRole("alert")
```

---

## 5. Mocking

Mock at the module boundary, not deep in implementation:

```ts
vi.mock("../api/client", () => ({
  getAllApiRecipesGet: vi.fn().mockResolvedValue({ data: { items: [] } }),
}))
```

Always clear mocks in `beforeEach`:
```ts
beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
})
```

For context-dependent components, use `renderWithProviders` from `src/test/render` — it wraps everything automatically.

---

## 6. Playwright E2E

### `playwright.config.ts`

```ts
import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
})
```

### Query strategy — same priority as RTL

```ts
// ✅ role-first
await page.getByRole("button", { name: /cook mode/i }).click()
await page.getByRole("heading", { name: /ingredients/i }).waitFor()

// ❌ CSS selectors are brittle
await page.locator(".cook-mode-btn").click()
```

### Network mocking for API-dependent flows

```ts
await page.route("/api/recipes", route =>
  route.fulfill({ json: { items: mockRecipes, total: 1 } })
)
```

---

## Full Compiled Document

For every rule with detailed rationale and full code examples: `AGENTS.md`

## Rule Files

Individual rule files in `rules/`:
- `rules/setup-vitest-rtl.md` — full setup walkthrough
- `rules/queries-screen-and-roles.md` — complete query hierarchy and examples
- `rules/interaction-user-event.md` — userEvent, act, async patterns
- `rules/assertions-jest-dom.md` — matchers, waitFor rules, explicit assertions
- `rules/mocking-strategy.md` — API, context, browser API, sessionStorage mocking
- `rules/playwright-e2e.md` — Playwright config, selectors, network, CI
