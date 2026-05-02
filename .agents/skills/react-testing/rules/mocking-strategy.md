---
title: Mocking Strategy
impact: HIGH
impactDescription: mocking at the wrong boundary creates brittle tests that break on internal refactors
tags: mocking, vi.mock, vi.fn, sessionStorage, browser-apis, context
---

## Mocking Strategy

### Mock at the module boundary

Mock the outermost layer the component depends on — the module export — not
the implementation detail inside it.

**Correct: mock the API module**

```ts
vi.mock("../api/client", () => ({
  getAllApiRecipesGet: vi.fn().mockResolvedValue({
    data: {
      items: [{ slug: "pasta-carbonara", name: "Pasta Carbonara" }],
      total: 1,
    },
  }),
}))
```

**Incorrect: mocking fetch directly**

```ts
// Fragile — breaks if the API client changes its HTTP strategy
vi.spyOn(global, "fetch").mockResolvedValue(
  new Response(JSON.stringify({ items: [] }))
)
```

**Rule:** Only mock what the component actually calls. Components in this codebase
don't call the API directly — route loaders do. Component tests therefore don't
need API mocks at all. Only integration tests that render the full route would.

---

### Clear mocks between tests

Always reset mock state in `beforeEach` to prevent test pollution.

```ts
beforeEach(() => {
  vi.clearAllMocks()     // Resets call counts, return values, implementations
  sessionStorage.clear() // Ingredient/step state must not leak between tests
})
```

`vi.clearAllMocks()` clears call history and return values but keeps the mock
function in place. It is the right default.

- `vi.resetAllMocks()` — also removes any custom implementations
- `vi.restoreAllMocks()` — restores original implementations (for `vi.spyOn`)

Use `vi.restoreAllMocks()` only when you've used `vi.spyOn` and need to restore
the original. Otherwise use `vi.clearAllMocks()`.

---

### sessionStorage — no extra mocking needed

jsdom provides a working `sessionStorage` implementation. The `useSessionStorage`
hook works in tests without any additional setup. `sessionStorage.clear()` in
`beforeEach` (already in `src/test/setup.ts`) ensures state doesn't leak.

**Testing that state is persisted:**

```ts
it("persists checked state to sessionStorage", async () => {
  const user = userEvent.setup()
  render(
    <IngredientCheckbox recipeId="abc" ingredientIndex={0} ingredient="flour" />
  )

  await user.click(screen.getByRole("checkbox"))

  expect(sessionStorage.getItem("recipe-abc-ingredient-0")).toBe("true")
})
```

**Testing that persisted state is read on mount:**

```ts
it("starts checked when sessionStorage has true", () => {
  sessionStorage.setItem("recipe-abc-ingredient-0", "true")

  render(
    <IngredientCheckbox recipeId="abc" ingredientIndex={0} ingredient="flour" />
  )

  expect(screen.getByRole("checkbox")).toBeChecked()
})
```

---

### Stub unsupported browser APIs

jsdom does not implement every browser API. Add stubs for missing APIs in
`src/test/setup.ts`.

**Pattern:**

```ts
Object.defineProperty(navigator, "wakeLock", {
  value: {
    request: vi.fn().mockResolvedValue({ release: vi.fn() }),
  },
  writable: true,
})
```

Using `vi.fn()` allows asserting the API was called in tests that care:

```ts
it("requests wake lock when cook mode is enabled", async () => {
  const user = userEvent.setup()
  render(<CookModeToggle />)

  await user.click(screen.getByRole("button", { name: /cook mode/i }))

  expect(navigator.wakeLock.request).toHaveBeenCalledWith("screen")
})
```

**Adding a new stub:**
1. Identify the missing API (from the error message or from reading the source)
2. Add a minimal stub in `src/test/setup.ts`
3. Use `vi.fn()` if tests need to assert on calls; use a static value otherwise

---

### Mock context via the custom render wrapper

The `render` from `src/test/render` wraps every component in `NuqsTestingAdapter`
and `CookModeProvider`. To test in a specific state, use the real context and
trigger via user interactions — or provide initial URL search params to
`NuqsTestingAdapter`.

**Preferred: trigger state through interaction**

```tsx
it("shows cook mode layout when activated", async () => {
  const user = userEvent.setup()
  render(<IngredientsSection ingredients={mockIngredients} recipeId="abc" />)

  // IngredientsSection is inside the provider via the custom render
  // Activate cook mode by clicking the toggle (rendered separately in real app)
  // For isolated component tests, provide the initial state via NuqsTestingAdapter
})
```

**Alternative: provide initial URL state for cook mode**

```tsx
import { render as rtlRender } from "@testing-library/react"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { CookModeProvider } from "../contexts/CookModeContext"

function CookModeWrapper({ children }: { children: React.ReactNode }) {
  return (
    <NuqsTestingAdapter searchParams="cook=true">
      <CookModeProvider>{children}</CookModeProvider>
    </NuqsTestingAdapter>
  )
}

it("shows cook mode layout", () => {
  rtlRender(
    <IngredientsSection ingredients={mockIngredients} recipeId="abc" />,
    { wrapper: CookModeWrapper }
  )

  expect(screen.getByRole("region", { name: /ingredients/i })).toHaveClass(
    "rounded-lg"
  )
})
```

Do not `vi.mock` the context module — that removes the real behaviour and makes
tests less valuable. Use the real provider with controlled initial state instead.
