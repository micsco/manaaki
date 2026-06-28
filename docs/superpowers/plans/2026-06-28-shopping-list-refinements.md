# Shopping-list Refinements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. (This batch is being executed inline.)

**Goal:** Add toast feedback, age-aware add-to-list (with override), recipe-source visibility (summary + per-item expander), and a back link to the shopping feature.

**Architecture:** Base UI `Toast` mounted at the root via a thin wrapper; a pure 48h staleness helper drives whether add-to-list appends or starts a new list; `recipeId→{name,slug}` resolved from the cached recipe list to render linked recipe sources.

**Tech Stack:** React 19, TanStack Router/Query, `@base-ui/react` Toast (already a dep), generated Mealie SDK, vitest + @testing-library/react.

## Global Constraints

- No new runtime dependencies — toasts use `@base-ui/react` `Toast`.
- Staleness rule: append to current list if `createdAt` ≤ 48h old, else start a new list.
- Override "New list instead" **moves** the recipe (remove from old + create new), never duplicates.
- Recipe-source labels link to recipe pages via `recipeUrl(id, slug)`; unknown ids render unlinked, never crash.
- Route files export only `Route`; shared UI lives in `src/components`/`src/utils`/`src/hooks`. Route-dir test files use a leading `-`.

---

## Task 1: Base UI Toast wrapper + root mount

**Files:**
- Create: `src/components/Toast.tsx`
- Modify: `src/routes/__root.tsx` (wrap providers)

**Interfaces:**
- Produces: `<AppToastProvider>` (wraps children + renders viewport); `useToast(): { add: (opts) => void }` re-exporting `Toast.useToastManager()`.

- [ ] **Step 1:** Implement `src/components/Toast.tsx`:

```tsx
import { Toast } from "@base-ui/react/toast"
import type { ReactNode } from "react"

function ToastList() {
  const { toasts } = Toast.useToastManager()
  return toasts.map(toast => (
    <Toast.Root
      key={toast.id}
      toast={toast}
      className="flex w-80 flex-col gap-1 rounded-lg border border-gray-700 bg-gray-900 p-3 text-sm shadow-lg"
    >
      <Toast.Title className="font-medium text-gray-100" />
      <Toast.Description className="text-gray-400" />
      {toast.actionProps && (
        <Toast.Action className="mt-1 self-start rounded-md bg-orange-600 px-2.5 py-1 font-medium text-white text-xs hover:bg-orange-500" />
      )}
      <Toast.Close aria-label="Dismiss" className="absolute top-2 right-2 text-gray-500 hover:text-gray-300">
        ×
      </Toast.Close>
    </Toast.Root>
  ))
}

export function AppToastProvider({ children }: { children: ReactNode }) {
  return (
    <Toast.Provider>
      {children}
      <Toast.Portal>
        <Toast.Viewport className="fixed right-0 bottom-0 left-0 z-[100] mx-auto flex max-w-2xl flex-col items-center gap-2 p-4">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  )
}

export function useToast() {
  return Toast.useToastManager()
}
```

- [ ] **Step 2:** In `src/routes/__root.tsx`, wrap the existing provider tree with `<AppToastProvider>` (import from `../components/Toast`) so `useToast()` works app-wide.
- [ ] **Step 3:** `pnpm type-check` + `pnpm build` (Base UI Toast must SSR cleanly). Expected: pass.
- [ ] **Step 4:** Commit `feat(shopping): app toast wrapper (Base UI Toast)`.

> No unit test for the provider itself; it's exercised via the components below (which mock `useToast`).

---

## Task 2: Pure helpers — staleness + recipe name map

**Files:**
- Modify: `src/utils/shopping.ts` (+ test `src/utils/shopping.test.ts`)
- Create: `src/hooks/useRecipeNameMap.ts` (+ test)

**Interfaces:**
- Produces: `shouldStartNewList(createdAt: string | null | undefined, now: number): boolean`; `useRecipeNameMap(): Map<string, { name: string; slug: string }>`.

- [ ] **Step 1 (failing test, append to shopping.test.ts):**

```ts
import { shouldStartNewList } from "./shopping"

describe("shouldStartNewList", () => {
  const now = Date.parse("2026-06-28T12:00:00Z")
  it("true when no createdAt", () => {
    expect(shouldStartNewList(null, now)).toBe(true)
    expect(shouldStartNewList(undefined, now)).toBe(true)
  })
  it("false when <= 48h old", () => {
    expect(shouldStartNewList("2026-06-26T12:00:01Z", now)).toBe(false)
  })
  it("true when > 48h old", () => {
    expect(shouldStartNewList("2026-06-26T11:59:59Z", now)).toBe(true)
  })
})
```

- [ ] **Step 2:** Append to `src/utils/shopping.ts`:

```ts
const STALE_MS = 48 * 60 * 60 * 1000

export function shouldStartNewList(
  createdAt: string | null | undefined,
  now: number
): boolean {
  if (!createdAt) return true
  const ts = Date.parse(createdAt)
  if (Number.isNaN(ts)) return true
  return now - ts > STALE_MS
}
```

- [ ] **Step 3 (useRecipeNameMap test):**

```tsx
// src/hooks/useRecipeNameMap.test.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it } from "vitest"
import { recipeListQueryOptions } from "./useRecipeList"
import { useRecipeNameMap } from "./useRecipeNameMap"

describe("useRecipeNameMap", () => {
  it("maps recipeId -> {name, slug}, dedupes, ignores id-less", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    qc.setQueryData(recipeListQueryOptions.queryKey, [
      { id: "r1", name: "Soup", slug: "soup" },
      { id: null, name: "x", slug: "x" },
    ])
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useRecipeNameMap(), { wrapper })
    expect(result.current.get("r1")).toEqual({ name: "Soup", slug: "soup" })
    expect(result.current.size).toBe(1)
  })
})
```

> Confirm `recipeListQueryOptions` is exported from `src/hooks/useRecipeList.ts` and returns `RecipeSummary[]`; adapt the seed/keys to its actual shape.

- [ ] **Step 4:** Implement `src/hooks/useRecipeNameMap.ts`:

```ts
import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import { recipeListQueryOptions } from "./useRecipeList"

export function useRecipeNameMap(): Map<string, { name: string; slug: string }> {
  const { data } = useQuery(recipeListQueryOptions)
  return useMemo(() => {
    const map = new Map<string, { name: string; slug: string }>()
    for (const r of data ?? []) {
      if (r.id && !map.has(r.id)) {
        map.set(r.id, { name: r.name ?? "Recipe", slug: r.slug ?? "" })
      }
    }
    return map
  }, [data])
}
```

- [ ] **Step 5:** Run both tests + type-check; commit `feat(shopping): staleness helper + recipe name map`.

---

## Task 3: Smart add-to-list (age branch, toasts, override)

**Files:**
- Modify: `src/components/AddToShoppingListButton.tsx` (+ test)

**Interfaces:**
- Consumes: `shouldStartNewList`, `buildShoppingList`, `useToast`, `useCurrentShoppingList`, `currentListQueryOptions`, SDK add + `removeRecipeIngredientsFromListApiHouseholdsShoppingListsItemIdRecipeRecipeIdDeletePost`.

- [ ] **Step 1 (test):** cover three behaviors (mock `useToast`, `useCurrentShoppingList`, `buildShoppingList`, and the SDK add):
  - anonymous → sign-in CTA (existing test stays).
  - current list ≤48h → calls SDK add to current; `toast.add` called with an `actionProps.children` of "New list instead".
  - no/stale current list → calls `buildShoppingList`; `toast.add` called (message mentions a new list).

```tsx
// representative case in src/components/AddToShoppingListButton.test.tsx
it("appends to a recent list and offers 'New list instead'", async () => {
  vi.spyOn(currentUser, "useCurrentUser").mockReturnValue({ user: { id: "u" }, isAnonymous: false } as never)
  vi.spyOn(shoppingList, "useCurrentShoppingList").mockReturnValue({ id: "l1", createdAt: new Date().toISOString() } as never)
  const add = vi.fn()
  vi.spyOn(toastMod, "useToast").mockReturnValue({ add } as never)
  const { default: userEvent } = await import("@testing-library/user-event")
  render(<AddToShoppingListButton recipe={recipe} />, { wrapper: wrap() })
  await userEvent.click(screen.getByRole("button", { name: /add to shopping list/i }))
  await waitFor(() => expect(sdk.addRecipeIngredientsToListApiHouseholdsShoppingListsItemIdRecipePost).toHaveBeenCalled())
  expect(add.mock.calls[0][0].actionProps.children).toMatch(/new list/i)
})
```

- [ ] **Step 2:** Rewrite the button's `add()`:

```tsx
// imports add: useToast, shouldStartNewList, removeRecipe..., useNavigate? (use window.location for nav from a recipe page)
async function add() {
  if (!recipe.id) return
  setState("adding")
  const recipeId = recipe.id
  const name = `Shop · ${new Date().toLocaleDateString()}`
  try {
    if (!list?.id || shouldStartNewList(list.createdAt, Date.now())) {
      const built = await buildShoppingList({ name, selections: [{ recipeId, recipeIncrementQuantity: 1 }] })
      toast.add({
        title: `Started a new shopping list`,
        description: `Added ${recipe.name ?? "recipe"}.`,
        actionProps: { children: "View list", onClick: () => window.location.assign(`/shopping?list=${built.listId}`) },
      })
    } else {
      const currentId = list.id
      const res = await addRecipeIngredientsToListApiHouseholdsShoppingListsItemIdRecipePost({
        path: { item_id: currentId },
        body: [{ recipeId, recipeIncrementQuantity: 1 }],
      })
      if (res.error) throw res.error
      toast.add({
        title: `Added ${recipe.name ?? "recipe"} to your list`,
        actionProps: {
          children: "New list instead",
          onClick: async () => {
            const built = await buildShoppingList({ name, selections: [{ recipeId, recipeIncrementQuantity: 1 }] })
            await removeRecipeIngredientsFromListApiHouseholdsShoppingListsItemIdRecipeRecipeIdDeletePost({
              path: { item_id: currentId, recipe_id: recipeId },
            }).catch(() => {})
            window.location.assign(`/shopping?list=${built.listId}`)
          },
        },
      })
    }
    qc.invalidateQueries({ queryKey: currentListQueryOptions.queryKey })
    setState("done")
  } catch {
    toast.add({ title: "Couldn't add to your shopping list" })
    setState("error")
  }
}
```

> Confirm `useCurrentShoppingList` returns a summary that includes `createdAt` (it returns `ShoppingListSummary`, which has `createdAt`).

- [ ] **Step 3:** Run the button test + full suite + type-check; commit `feat(shopping): age-aware add-to-list with toast + new-list override`.

---

## Task 4: Recipe sources — top summary + per-item expander

**Files:**
- Create: `src/components/ShoppingListRecipes.tsx` (+ test)
- Modify: `src/components/ShoppingListItemRow.tsx` (+ test) and `src/components/ShoppingListView.tsx` (render the summary)

**Interfaces:**
- Consumes: `useRecipeNameMap`, `recipeUrl` (`src/utils/recipe`), `ShoppingListRecipeRefOut`, `ShoppingListItemOutOutput`.
- Produces: `<ShoppingListRecipes refs={ShoppingListRecipeRefOut[]} />`; `ShoppingListItemRow` gains an expander when `item.recipeReferences?.length`.

- [ ] **Step 1 (ShoppingListRecipes test):** given refs + a seeded recipe map, renders linked recipe names; renders nothing when refs empty.
- [ ] **Step 2:** Implement `ShoppingListRecipes.tsx`:

```tsx
import { Link } from "@tanstack/react-router"
import type { ShoppingListRecipeRefOut } from "../api/generated"
import { useRecipeNameMap } from "../hooks/useRecipeNameMap"
import { recipeUrl } from "../utils/recipe"

export function ShoppingListRecipes({ refs }: { refs: ShoppingListRecipeRefOut[] }) {
  const names = useRecipeNameMap()
  const ids = [...new Set(refs.map(r => r.recipeId))]
  if (ids.length === 0) return null
  return (
    <section className="mx-auto max-w-2xl px-4 pt-4">
      <h2 className="mb-1 font-semibold text-gray-400 text-sm uppercase tracking-wide">Recipes in this list</h2>
      <ul className="flex flex-wrap gap-2">
        {ids.map(id => {
          const r = names.get(id)
          return (
            <li key={id}>
              {r?.slug ? (
                <Link to={recipeUrl(id, r.slug)} className="rounded-full bg-gray-800 px-3 py-1 text-gray-200 text-sm hover:bg-gray-700">
                  {r.name}
                </Link>
              ) : (
                <span className="rounded-full bg-gray-800 px-3 py-1 text-gray-400 text-sm">Recipe</span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
```

> Verify `recipeUrl(id, slug)` signature in `src/utils/recipe.ts` and that `<Link to=...>` accepts the produced path (it's used in RecipeFooter via a plain string today — match that usage; may need `<a href>` instead of `<Link>` if `recipeUrl` returns a full path string).

- [ ] **Step 3 (ShoppingListItemRow expander test):** when `item.recipeReferences` has entries, an expander toggle appears; activating it reveals the recipe name(s); absent when no refs.
- [ ] **Step 4:** Add the expander to `ShoppingListItemRow.tsx` — a small button (distinct `aria-label="Show recipes"`) shown only when `item.recipeReferences?.length`, toggling local `expanded` state that renders a sub-line of recipe links (resolved via `useRecipeNameMap`). Keep toggle + delete controls intact.
- [ ] **Step 5:** In `ShoppingListView.tsx`, render `<ShoppingListRecipes refs={list.recipeReferences ?? []} />` above the groups.
- [ ] **Step 6:** Run tests + full suite + type-check; commit `feat(shopping): show source recipes (summary + per-item expander)`.

---

## Task 5: Back link + build-success toast

**Files:**
- Modify: `src/routes/shopping.tsx` (back link), `src/components/BuildShoppingListDialog.tsx` (success toast)

- [ ] **Step 1:** In `src/routes/shopping.tsx` header, add a back link to `/recipes` before the title, matching `/plan`'s chevron-left "Recipes" link (`<Link to="/recipes" className="...">`).
- [ ] **Step 2:** In `BuildShoppingListDialog.tsx` `confirm()`, after a successful `buildShoppingList`, call `useToast().add({ title: \`Created a shopping list from ${selections.length} recipes\` })` before `onBuilt(result)`.
- [ ] **Step 3 (test):** extend the dialog test to assert the toast is added on a successful build (mock `useToast`). Add a `/shopping` render check that a Recipes back link is present (or assert in an existing shopping route test).
- [ ] **Step 4:** Run full suite + type-check + `pnpm build`; commit `feat(shopping): back link out of /shopping + build-success toast`.

---

## Task 6: Validate

- [ ] `pnpm validate && pnpm test && pnpm build` all green.
- [ ] Manual (post-deploy): add a recipe with a recent list → appends + toast with "New list instead"; with no/old list → new list; expand an item → shows its recipe(s); top summary links open recipes; back link leaves `/shopping`.

---

## Self-Review (completed during authoring)

- **Spec coverage:** toasts via Base UI (T1); 48h staleness + add branch + override (T2/T3); feedback toasts (T3/T5); recipe summary + per-item expander, linked (T2/T4); back link (T5); build toast (T5). All covered.
- **Placeholders:** none — code given per step. A few "confirm against actual file" notes (recipeListQueryOptions shape, recipeUrl signature, Base UI add option name) are verification steps, resolved at implementation.
- **Type consistency:** `shouldStartNewList`, `useRecipeNameMap`, `useToast`, `AppToastProvider`, `ShoppingListRecipes` used consistently across tasks.
