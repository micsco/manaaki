---
title: Vitest + React Testing Library Setup
impact: CRITICAL
impactDescription: correct setup is the foundation for every other testing rule
tags: setup, vitest, rtl, jsdom, providers
---

## Vitest + React Testing Library Setup

### Required packages

```bash
pnpm add -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
pnpm add -D @playwright/test
npx playwright install chromium
```

| Package | Purpose |
|---------|---------|
| `vitest` | Test runner — Vite-native, shares transform pipeline with the app |
| `@vitest/coverage-v8` | Coverage via V8 built-in instrumentation |
| `@testing-library/react` | Renders components into a real jsdom DOM |
| `@testing-library/user-event` | Realistic browser event sequences |
| `@testing-library/jest-dom` | Custom matchers: `toBeInTheDocument`, `toBeChecked`, etc. |
| `jsdom` | DOM environment for Vitest |
| `@playwright/test` | Browser-based E2E with TypeScript support built in |

---

### `vitest.config.ts`

Place in project root, separate from `vite.config.ts`.

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

Key settings:
- `globals: true` — `describe`, `it`, `expect`, `vi`, `beforeEach` available without importing
- `environment: "jsdom"` — simulated browser DOM
- `setupFiles` — runs before each test file

---

### `src/test/setup.ts`

Extends `expect` with jest-dom matchers and stubs browser APIs that jsdom
doesn't implement.

```ts
import "@testing-library/jest-dom/vitest"

// navigator.wakeLock — used by CookModeProvider; not in jsdom
Object.defineProperty(navigator, "wakeLock", {
  value: {
    request: vi.fn().mockResolvedValue({ release: vi.fn() }),
  },
  writable: true,
})

beforeEach(() => {
  // Ingredient and step checkbox state must not leak between tests
  sessionStorage.clear()
})
```

Import `@testing-library/jest-dom/vitest` (not `/jest`) — the `/vitest`
entrypoint registers matchers with Vitest's `expect`.

---

### `src/test/render.tsx` — custom render with providers

**This is the most important setup decision.**

All component tests must render inside the same provider tree the app uses.
Create a custom `render` that wraps every component in required providers and
re-exports everything from `@testing-library/react`.

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

All component tests import from `src/test/render`, not from `@testing-library/react`:

```tsx
// ✅
import { render, screen } from "../test/render"

// ❌ — components fail because required context is absent
import { render, screen } from "@testing-library/react"
```

Why `NuqsTestingAdapter`: `CookModeProvider` calls `useQueryState` from nuqs,
which requires a router context. `NuqsTestingAdapter` provides that context
without a real router.

---

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "types": ["vite/client", "vitest/globals"]
  }
}
```

`vitest/globals` makes `vi`, `describe`, `it`, `expect`, `beforeEach` etc.
available without explicit imports in every test file.

---

### Package scripts

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
