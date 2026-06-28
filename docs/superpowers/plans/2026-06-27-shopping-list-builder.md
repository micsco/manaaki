# Shopping-list Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A manaaki shopping-list experience over Mealie's API: build a new list from the next N planned days (review + per-recipe servings scaling), add individual recipes to the current list, and an in-store aisle-grouped check-off view.

**Architecture:** New `/shopping` route (authed-gated like `/plan`) renders the *current* list (most-recently-created). Pure helpers in `src/utils/shopping.ts` do date math, plan-recipe normalisation/aggregation, scale arithmetic, the output→update field mapper, and aisle grouping. React Query hooks wrap the generated Mealie SDK (calls go through the browser's global client → BFF → Mealie). The builder is a shared dialog reachable from `/plan` and `/shopping`. All writes are authed pass-through (Mealie authorises).

**Tech Stack:** TanStack Start/Router, `@tanstack/react-query` (incl. `useMutation`), the `@hey-api` generated client (`src/api/generated`), vitest + jsdom + @testing-library/react.

## Global Constraints

- No new runtime dependencies.
- Shared UI/utilities live OUTSIDE route modules (`src/components/`, `src/utils/`, `src/hooks/`). Route files export only `Route`; route-dir test files need a leading `-` (e.g. `-x.test.tsx`). (Per `AGENTS.md`.)
- Authed-only feature, gated like `/plan` (`beforeLoad` → `fetchCurrentUser()` → `throw redirect({ href: "/api/auth/oauth" })` when anonymous). Server-side enforcement already exists (shopping paths absent from the anonymous allowlist → BFF 403s).
- Current list query is explicit + separate from history: `orderBy: "createdAt", orderDirection: "desc", orderByNullPosition: "last", perPage: 1`.
- "Next N days" = `start_date = today`, `end_date = today + (N − 1)` (inclusive → exactly N dates).
- Check-off uses an explicit field mapper (never spread the response object); reconcile via `updatedItems?.find(i => i.id === id)` with refetch fallback (collections are optional).
- Per-item check-off is serialized (no concurrent toggles of the same item).
- Mealie path param for a list id is `item_id`.
- Mealie endpoints used (via BFF): `getAllApiHouseholdsShoppingListsGet`, `createOneApiHouseholdsShoppingListsPost`, `getOneApiHouseholdsShoppingListsItemIdGet`, `addRecipeIngredientsToListApiHouseholdsShoppingListsItemIdRecipePost`, `updateOneApiHouseholdsShoppingItemsItemIdPut`, `createManyApiHouseholdsShoppingItemsCreateBulkPost`, `deleteOneApiHouseholdsShoppingItemsItemIdDelete`, `deleteOneApiHouseholdsShoppingListsItemIdDelete`.

---

## File Structure

**New:**
- `src/utils/shopping.ts` — pure helpers (date range, plan-recipe gathering, scale, item-update mapper, aisle grouping).
- `src/hooks/useShoppingList.ts` — read queries (current, detail, history).
- `src/hooks/useShoppingMutations.ts` — mutations (check-off, manual add, delete, build, add-recipe).
- `src/components/ShoppingListItemRow.tsx` — one item row (cook-mode styling).
- `src/components/ShoppingListView.tsx` — current/opened list view (aisle groups, add, states).
- `src/components/BuildShoppingListDialog.tsx` — day picker → review → confirm.
- `src/components/AddToShoppingListButton.tsx` — recipe-page action.
- `src/components/ShoppingListHistory.tsx` — previous lists.
- `src/routes/shopping.tsx` — `/shopping` route (guard + view + history via `?list=`).

**Modified:**
- `src/components/UserMenu.tsx` — add "Shopping" link.
- `src/routes/plan.tsx` — add "Build shopping list" trigger.
- `src/components/RecipeHeader.tsx` — add `AddToShoppingListButton`.

---

## Task 1: Pure helpers — day range + plan-recipe gathering

**Files:**
- Create: `src/utils/shopping.ts`
- Test: `src/utils/shopping.test.ts`

**Interfaces:**
- Consumes: `toIsoDateString` from `../hooks/useMealPlan`; `ReadPlanEntry` from `../api/generated`.
- Produces:
  - `type GatheredRecipe = { recipeId: string; name: string; baseServings: number | null; occurrences: number }`
  - `shoppingDayRange(today: Date, days: number): { start: string; end: string }`
  - `gatherPlanRecipes(entries: ReadPlanEntry[]): GatheredRecipe[]`

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/shopping.test.ts
import { describe, expect, it } from "vitest"
import type { ReadPlanEntry } from "../api/generated"
import { gatherPlanRecipes, shoppingDayRange } from "./shopping"

describe("shoppingDayRange", () => {
  it("spans exactly N days, today as day 1 (end = today + N-1)", () => {
    expect(shoppingDayRange(new Date(2026, 5, 28), 5)).toEqual({
      start: "2026-06-28",
      end: "2026-07-02",
    })
  })
  it("N=1 is just today", () => {
    expect(shoppingDayRange(new Date(2026, 11, 31), 1)).toEqual({
      start: "2026-12-31",
      end: "2026-12-31",
    })
  })
  it("crosses a month/year boundary correctly", () => {
    expect(shoppingDayRange(new Date(2026, 11, 30), 4)).toEqual({
      start: "2026-12-30",
      end: "2027-01-02",
    })
  })
})

function entry(over: Partial<ReadPlanEntry>): ReadPlanEntry {
  return { date: "2026-06-28", id: 1, groupId: "g", userId: "u", householdId: "h", ...over } as ReadPlanEntry
}

describe("gatherPlanRecipes", () => {
  it("skips entries with no usable recipe id (free-text)", () => {
    const out = gatherPlanRecipes([entry({ title: "Takeaway", recipeId: null, recipe: null })])
    expect(out).toEqual([])
  })
  it("derives id from recipeId or recipe.id, name from recipe.name/title", () => {
    const out = gatherPlanRecipes([
      entry({ recipeId: "r1", recipe: { id: "r1", name: "Soup", recipeServings: 4 } as never }),
      entry({ recipeId: null, recipe: { id: "r2", name: null } as never, title: "Mystery" }),
    ])
    expect(out).toEqual([
      { recipeId: "r1", name: "Soup", baseServings: 4, occurrences: 1 },
      { recipeId: "r2", name: "Mystery", baseServings: null, occurrences: 1 },
    ])
  })
  it("aggregates duplicate recipes and counts occurrences", () => {
    const r = { id: "r1", name: "Chilli", recipeServings: 4 } as never
    const out = gatherPlanRecipes([entry({ recipeId: "r1", recipe: r }), entry({ recipeId: "r1", recipe: r })])
    expect(out).toEqual([{ recipeId: "r1", name: "Chilli", baseServings: 4, occurrences: 2 }])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/utils/shopping.test.ts`
Expected: FAIL — cannot find module `./shopping`.

- [ ] **Step 3: Write the implementation**

```ts
// src/utils/shopping.ts
import type { ReadPlanEntry } from "../api/generated"
import { toIsoDateString } from "../hooks/useMealPlan"

export type GatheredRecipe = {
  recipeId: string
  name: string
  baseServings: number | null
  occurrences: number
}

export function shoppingDayRange(today: Date, days: number): { start: string; end: string } {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const end = new Date(start)
  end.setDate(start.getDate() + (days - 1))
  return { start: toIsoDateString(start), end: toIsoDateString(end) }
}

export function gatherPlanRecipes(entries: ReadPlanEntry[]): GatheredRecipe[] {
  const byId = new Map<string, GatheredRecipe>()
  for (const e of entries) {
    const recipeId = e.recipeId ?? e.recipe?.id ?? null
    if (!recipeId) continue
    const existing = byId.get(recipeId)
    if (existing) {
      existing.occurrences += 1
      continue
    }
    byId.set(recipeId, {
      recipeId,
      name: e.recipe?.name ?? e.title ?? "Recipe",
      baseServings:
        typeof e.recipe?.recipeServings === "number" ? e.recipe.recipeServings : null,
      occurrences: 1,
    })
  }
  return [...byId.values()]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/utils/shopping.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/shopping.ts src/utils/shopping.test.ts
git commit -m "feat(shopping): pure day-range + plan-recipe gathering helpers"
```

---

## Task 2: Pure helpers — scale, item-update mapper, aisle grouping

**Files:**
- Modify: `src/utils/shopping.ts`
- Modify: `src/utils/shopping.test.ts`

**Interfaces:**
- Consumes: `ShoppingListItemOutOutput`, `ShoppingListItemUpdate`, `ShoppingListMultiPurposeLabelOut` from `../api/generated`.
- Produces:
  - `computeRecipeIncrement(args: { mode: "servings" | "multiplier"; value: number; baseServings: number | null }): number`
  - `itemUpdateFromOutput(item: ShoppingListItemOutOutput, patch: { checked?: boolean }): ShoppingListItemUpdate`
  - `type AisleGroup = { labelId: string | null; name: string; items: ShoppingListItemOutOutput[] }`
  - `groupItemsByAisle(items: ShoppingListItemOutOutput[], labelSettings: ShoppingListMultiPurposeLabelOut[]): AisleGroup[]`

- [ ] **Step 1: Write the failing test (append)**

```ts
// append to src/utils/shopping.test.ts
import type { ShoppingListItemOutOutput, ShoppingListMultiPurposeLabelOut } from "../api/generated"
import { computeRecipeIncrement, groupItemsByAisle, itemUpdateFromOutput } from "./shopping"

describe("computeRecipeIncrement", () => {
  it("servings mode: chosen / base", () => {
    expect(computeRecipeIncrement({ mode: "servings", value: 6, baseServings: 4 })).toBe(1.5)
  })
  it("multiplier mode: value passes through", () => {
    expect(computeRecipeIncrement({ mode: "multiplier", value: 2, baseServings: null })).toBe(2)
  })
  it("servings mode with base <= 0 or null falls back to value (no divide-by-zero)", () => {
    expect(computeRecipeIncrement({ mode: "servings", value: 2, baseServings: 0 })).toBe(2)
    expect(computeRecipeIncrement({ mode: "servings", value: 3, baseServings: null })).toBe(3)
  })
})

function item(over: Partial<ShoppingListItemOutOutput>): ShoppingListItemOutOutput {
  return { id: "i", shoppingListId: "l", groupId: "g", householdId: "h", ...over } as ShoppingListItemOutOutput
}

describe("itemUpdateFromOutput", () => {
  it("copies only accepted scalar/id fields + applies patch (never response-only fields)", () => {
    const out = itemUpdateFromOutput(
      item({ id: "i1", shoppingListId: "l1", quantity: 2, note: "n", display: "2 eggs", position: 3, foodId: "f", labelId: "lab", unitId: "u", checked: false }),
      { checked: true }
    )
    expect(out).toEqual({
      shoppingListId: "l1",
      quantity: 2,
      note: "n",
      display: "2 eggs",
      position: 3,
      foodId: "f",
      labelId: "lab",
      unitId: "u",
      checked: true,
    })
    expect(out).not.toHaveProperty("id")
    expect(out).not.toHaveProperty("label")
    expect(out).not.toHaveProperty("food")
  })
})

describe("groupItemsByAisle", () => {
  const settings = [
    { id: "s2", shoppingListId: "l", labelId: "produce", position: 1, label: { id: "produce", name: "Produce", groupId: "g" } },
    { id: "s1", shoppingListId: "l", labelId: "dairy", position: 0, label: { id: "dairy", name: "Dairy", groupId: "g" } },
  ] as ShoppingListMultiPurposeLabelOut[]
  it("groups by label, orders groups by labelSettings position, unlabelled last", () => {
    const items = [
      item({ id: "a", labelId: "produce", label: { id: "produce", name: "Produce", groupId: "g" } as never }),
      item({ id: "b", labelId: "dairy", label: { id: "dairy", name: "Dairy", groupId: "g" } as never }),
      item({ id: "c", labelId: null, label: null }),
    ]
    const groups = groupItemsByAisle(items, settings)
    expect(groups.map(g => g.name)).toEqual(["Dairy", "Produce", "Other"])
    expect(groups[2].items.map(i => i.id)).toEqual(["c"])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/utils/shopping.test.ts`
Expected: FAIL — exports not found.

- [ ] **Step 3: Add the implementation (append to `src/utils/shopping.ts`)**

```ts
import type {
  ShoppingListItemOutOutput,
  ShoppingListItemUpdate,
  ShoppingListMultiPurposeLabelOut,
} from "../api/generated"

export function computeRecipeIncrement(args: {
  mode: "servings" | "multiplier"
  value: number
  baseServings: number | null
}): number {
  if (args.mode === "multiplier") return args.value
  if (args.baseServings && args.baseServings > 0) return args.value / args.baseServings
  return args.value
}

// Map a response item to an update payload: ONLY accepted scalar/id fields.
// Never spread the output object (its food/unit/label are Output types the
// Update schema doesn't accept; id/groupId/etc. are response-only).
export function itemUpdateFromOutput(
  item: ShoppingListItemOutOutput,
  patch: { checked?: boolean }
): ShoppingListItemUpdate {
  const update: ShoppingListItemUpdate = { shoppingListId: item.shoppingListId }
  if (item.quantity !== undefined) update.quantity = item.quantity
  if (item.note !== undefined) update.note = item.note
  if (item.display !== undefined) update.display = item.display
  if (item.position !== undefined) update.position = item.position
  if (item.foodId !== undefined) update.foodId = item.foodId
  if (item.labelId !== undefined) update.labelId = item.labelId
  if (item.unitId !== undefined) update.unitId = item.unitId
  update.checked = patch.checked ?? item.checked ?? false
  return update
}

export type AisleGroup = {
  labelId: string | null
  name: string
  items: ShoppingListItemOutOutput[]
}

export function groupItemsByAisle(
  items: ShoppingListItemOutOutput[],
  labelSettings: ShoppingListMultiPurposeLabelOut[]
): AisleGroup[] {
  const position = new Map<string, number>()
  for (const s of labelSettings) position.set(s.labelId, s.position ?? Number.MAX_SAFE_INTEGER)

  const groups = new Map<string, AisleGroup>()
  for (const it of items) {
    const labelId = it.labelId ?? null
    const key = labelId ?? "__none__"
    let group = groups.get(key)
    if (!group) {
      group = { labelId, name: labelId ? (it.label?.name ?? "Other") : "Other", items: [] }
      groups.set(key, group)
    }
    group.items.push(it)
  }

  return [...groups.values()].sort((a, b) => {
    const pa = a.labelId ? (position.get(a.labelId) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER
    const pb = b.labelId ? (position.get(b.labelId) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER
    if (pa !== pb) return pa - pb
    return a.name.localeCompare(b.name)
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/utils/shopping.test.ts`
Expected: PASS (all groups).

- [ ] **Step 5: Commit**

```bash
git add src/utils/shopping.ts src/utils/shopping.test.ts
git commit -m "feat(shopping): scale, item-update mapper, aisle grouping helpers"
```

---

## Task 3: Read hooks — current list, detail, history

**Files:**
- Create: `src/hooks/useShoppingList.ts`
- Test: `src/hooks/useShoppingList.test.ts`

**Interfaces:**
- Consumes: SDK `getAllApiHouseholdsShoppingListsGet`, `getOneApiHouseholdsShoppingListsItemIdGet`; `OrderByNullPosition` type; `ShoppingListOut`/`ShoppingListSummary`.
- Produces:
  - `currentListQueryOptions` (returns `ShoppingListSummary | null`)
  - `useCurrentShoppingList(): ShoppingListSummary | null | undefined`
  - `shoppingListDetailQueryOptions(id: string)` (returns `ShoppingListOut`)
  - `useShoppingListDetail(id: string | undefined)`
  - `shoppingHistoryQueryOptions(page: number)` (returns `ShoppingListSummary[]`)

- [ ] **Step 1: Write the failing test**

```ts
// src/hooks/useShoppingList.test.ts
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import * as sdk from "../api/generated/sdk.gen"
import { useCurrentShoppingList } from "./useShoppingList"

vi.mock("../api/generated/sdk.gen", () => ({
  getAllApiHouseholdsShoppingListsGet: vi.fn(),
  getOneApiHouseholdsShoppingListsItemIdGet: vi.fn(),
}))

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
}

describe("useCurrentShoppingList", () => {
  beforeEach(() => vi.clearAllMocks())

  it("requests newest-first with perPage 1 and returns items[0]", async () => {
    vi.mocked(sdk.getAllApiHouseholdsShoppingListsGet).mockResolvedValue({
      data: { items: [{ id: "newest", name: "Shop" }] },
    } as never)
    const { result } = renderHook(() => useCurrentShoppingList(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current?.id).toBe("newest"))
    const arg = vi.mocked(sdk.getAllApiHouseholdsShoppingListsGet).mock.calls[0][0] as never
    expect((arg as { query: Record<string, unknown> }).query).toMatchObject({
      orderBy: "createdAt",
      orderDirection: "desc",
      perPage: 1,
    })
  })

  it("returns null when there are no lists", async () => {
    vi.mocked(sdk.getAllApiHouseholdsShoppingListsGet).mockResolvedValue({
      data: { items: [] },
    } as never)
    const { result } = renderHook(() => useCurrentShoppingList(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current).toBeNull())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/hooks/useShoppingList.test.ts`
Expected: FAIL — cannot find module `./useShoppingList`.

- [ ] **Step 3: Write the implementation**

```ts
// src/hooks/useShoppingList.ts
import { queryOptions, useQuery } from "@tanstack/react-query"
import {
  getAllApiHouseholdsShoppingListsGet,
  getOneApiHouseholdsShoppingListsItemIdGet,
  type OrderByNullPosition,
  type ShoppingListOut,
  type ShoppingListSummary,
} from "../api/generated"

export const currentListQueryOptions = queryOptions({
  queryKey: ["shopping", "current"],
  queryFn: async (): Promise<ShoppingListSummary | null> => {
    const res = await getAllApiHouseholdsShoppingListsGet({
      query: {
        orderBy: "createdAt",
        orderDirection: "desc",
        orderByNullPosition: "last" as OrderByNullPosition,
        perPage: 1,
      },
    })
    return res.data?.items?.[0] ?? null
  },
  staleTime: 60_000,
})

export function useCurrentShoppingList(): ShoppingListSummary | null | undefined {
  return useQuery(currentListQueryOptions).data
}

export function shoppingListDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["shopping", "list", id],
    queryFn: async (): Promise<ShoppingListOut> => {
      const res = await getOneApiHouseholdsShoppingListsItemIdGet({ path: { item_id: id } })
      if (!res.data) throw new Error("Failed to load shopping list")
      return res.data
    },
    staleTime: 60_000,
  })
}

export function useShoppingListDetail(id: string | undefined) {
  return useQuery({ ...shoppingListDetailQueryOptions(id ?? ""), enabled: Boolean(id) })
}

export function shoppingHistoryQueryOptions(page: number) {
  return queryOptions({
    queryKey: ["shopping", "history", page],
    queryFn: async (): Promise<ShoppingListSummary[]> => {
      const res = await getAllApiHouseholdsShoppingListsGet({
        query: {
          orderBy: "createdAt",
          orderDirection: "desc",
          orderByNullPosition: "last" as OrderByNullPosition,
          page,
          perPage: 30,
        },
      })
      return res.data?.items ?? []
    },
    staleTime: 60_000,
  })
}
```

> If `"last"` is not assignable to `OrderByNullPosition`, check the enum's literals in `types.gen.ts` and use the correct one.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/hooks/useShoppingList.test.ts && pnpm type-check`
Expected: PASS; type-check clean.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useShoppingList.ts src/hooks/useShoppingList.test.ts
git commit -m "feat(shopping): read hooks (current list, detail, history)"
```

---

## Task 4: Mutation hooks — check-off (serialized + optimistic), manual add, delete

**Files:**
- Create: `src/hooks/useShoppingMutations.ts`
- Test: `src/hooks/useShoppingMutations.test.ts`

**Interfaces:**
- Consumes: `itemUpdateFromOutput` (Task 2); SDK `updateOneApiHouseholdsShoppingItemsItemIdPut`, `createManyApiHouseholdsShoppingItemsCreateBulkPost`, `deleteOneApiHouseholdsShoppingItemsItemIdDelete`; `shoppingListDetailQueryOptions` queryKey.
- Produces:
  - `useToggleItem(listId: string)` → `{ toggle(item: ShoppingListItemOutOutput): void; pendingIds: Set<string> }`
  - `useAddManualItem(listId: string)` → `{ add(display: string): Promise<void> }`
  - `useDeleteItem(listId: string)` → `{ remove(itemId: string): Promise<void> }`

Serialization: `toggle` ignores an item whose id is already in `pendingIds`. Optimistic: flip `checked` in the cached `ShoppingListOut.listItems`; on settle, reconcile from `updatedItems?.find` or invalidate.

- [ ] **Step 1: Write the failing test**

```ts
// src/hooks/useShoppingMutations.test.ts
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import * as sdk from "../api/generated/sdk.gen"
import { shoppingListDetailQueryOptions } from "./useShoppingList"
import { useToggleItem } from "./useShoppingMutations"

vi.mock("../api/generated/sdk.gen", () => ({
  updateOneApiHouseholdsShoppingItemsItemIdPut: vi.fn(),
  createManyApiHouseholdsShoppingItemsCreateBulkPost: vi.fn(),
  deleteOneApiHouseholdsShoppingItemsItemIdDelete: vi.fn(),
}))

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  qc.setQueryData(shoppingListDetailQueryOptions("l1").queryKey, {
    id: "l1",
    listItems: [{ id: "i1", shoppingListId: "l1", checked: false, display: "Eggs" }],
    labelSettings: [],
  })
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
  return { qc, wrapper }
}

describe("useToggleItem", () => {
  beforeEach(() => vi.clearAllMocks())

  it("optimistically flips checked and sends a mapped update", async () => {
    vi.mocked(sdk.updateOneApiHouseholdsShoppingItemsItemIdPut).mockResolvedValue({
      data: { updatedItems: [{ id: "i1", shoppingListId: "l1", checked: true, display: "Eggs" }] },
    } as never)
    const { qc, wrapper } = setup()
    const { result } = renderHook(() => useToggleItem("l1"), { wrapper })

    act(() => result.current.toggle({ id: "i1", shoppingListId: "l1", checked: false, display: "Eggs" } as never))

    const body = vi.mocked(sdk.updateOneApiHouseholdsShoppingItemsItemIdPut).mock.calls[0][0] as never
    expect((body as { path: { item_id: string } }).path.item_id).toBe("i1")
    expect((body as { body: { shoppingListId: string; checked: boolean } }).body).toMatchObject({
      shoppingListId: "l1",
      checked: true,
    })

    await waitFor(() => {
      const list = qc.getQueryData(shoppingListDetailQueryOptions("l1").queryKey) as { listItems: { checked: boolean }[] }
      expect(list.listItems[0].checked).toBe(true)
    })
  })

  it("serializes: a second toggle while the first is pending is ignored", async () => {
    let resolve!: (v: unknown) => void
    vi.mocked(sdk.updateOneApiHouseholdsShoppingItemsItemIdPut).mockReturnValue(
      new Promise(r => { resolve = r }) as never
    )
    const { wrapper } = setup()
    const { result } = renderHook(() => useToggleItem("l1"), { wrapper })
    const item = { id: "i1", shoppingListId: "l1", checked: false, display: "Eggs" } as never

    act(() => result.current.toggle(item))
    act(() => result.current.toggle(item)) // ignored — i1 pending
    expect(vi.mocked(sdk.updateOneApiHouseholdsShoppingItemsItemIdPut)).toHaveBeenCalledTimes(1)
    act(() => resolve({ data: { updatedItems: [] } }))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/hooks/useShoppingMutations.test.ts`
Expected: FAIL — cannot find module `./useShoppingMutations`.

- [ ] **Step 3: Write the implementation**

```ts
// src/hooks/useShoppingMutations.ts
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRef, useState } from "react"
import {
  createManyApiHouseholdsShoppingItemsCreateBulkPost,
  deleteOneApiHouseholdsShoppingItemsItemIdDelete,
  type ShoppingListItemOutOutput,
  type ShoppingListOut,
  updateOneApiHouseholdsShoppingItemsItemIdPut,
} from "../api/generated"
import { itemUpdateFromOutput } from "../utils/shopping"
import { shoppingListDetailQueryOptions } from "./useShoppingList"

export function useToggleItem(listId: string) {
  const qc = useQueryClient()
  const key = shoppingListDetailQueryOptions(listId).queryKey
  const pending = useRef(new Set<string>())
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const sync = () => setPendingIds(new Set(pending.current))

  const mutation = useMutation({
    mutationFn: async (item: ShoppingListItemOutOutput) => {
      const res = await updateOneApiHouseholdsShoppingItemsItemIdPut({
        path: { item_id: item.id },
        body: itemUpdateFromOutput(item, { checked: !item.checked }),
      })
      return res.data
    },
    onMutate: (item) => {
      qc.setQueryData<ShoppingListOut>(key, (prev) =>
        prev
          ? {
              ...prev,
              listItems: (prev.listItems ?? []).map((i) =>
                i.id === item.id ? { ...i, checked: !item.checked } : i
              ),
            }
          : prev
      )
    },
    onError: (_e, item) => {
      qc.setQueryData<ShoppingListOut>(key, (prev) =>
        prev
          ? {
              ...prev,
              listItems: (prev.listItems ?? []).map((i) =>
                i.id === item.id ? { ...i, checked: item.checked } : i
              ),
            }
          : prev
      )
    },
    onSuccess: (data, item) => {
      const updated = data?.updatedItems?.find((i) => i.id === item.id)
      if (updated) {
        qc.setQueryData<ShoppingListOut>(key, (prev) =>
          prev
            ? { ...prev, listItems: (prev.listItems ?? []).map((i) => (i.id === item.id ? updated : i)) }
            : prev
        )
      } else {
        qc.invalidateQueries({ queryKey: key })
      }
    },
    onSettled: (_d, _e, item) => {
      pending.current.delete(item.id)
      sync()
    },
  })

  function toggle(item: ShoppingListItemOutOutput) {
    if (pending.current.has(item.id)) return
    pending.current.add(item.id)
    sync()
    mutation.mutate(item)
  }

  return { toggle, pendingIds }
}

export function useAddManualItem(listId: string) {
  const qc = useQueryClient()
  const key = shoppingListDetailQueryOptions(listId).queryKey
  const mutation = useMutation({
    mutationFn: async (display: string) => {
      const trimmed = display.trim()
      if (!trimmed) return
      await createManyApiHouseholdsShoppingItemsCreateBulkPost({
        body: [{ shoppingListId: listId, display: trimmed }],
      })
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
  return { add: (display: string) => mutation.mutateAsync(display).then(() => undefined) }
}

export function useDeleteItem(listId: string) {
  const qc = useQueryClient()
  const key = shoppingListDetailQueryOptions(listId).queryKey
  const mutation = useMutation({
    mutationFn: async (itemId: string) => {
      await deleteOneApiHouseholdsShoppingItemsItemIdDelete({ path: { item_id: itemId } })
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
  return { remove: (itemId: string) => mutation.mutateAsync(itemId).then(() => undefined) }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/hooks/useShoppingMutations.test.ts && pnpm type-check`
Expected: PASS; type-check clean.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useShoppingMutations.ts src/hooks/useShoppingMutations.test.ts
git commit -m "feat(shopping): item mutations (serialized check-off, manual add, delete)"
```

---

## Task 5: Build mutation — create-and-add state machine

**Files:**
- Modify: `src/hooks/useShoppingMutations.ts`
- Modify: `src/hooks/useShoppingMutations.test.ts`

**Interfaces:**
- Consumes: SDK `createOneApiHouseholdsShoppingListsPost`, `addRecipeIngredientsToListApiHouseholdsShoppingListsItemIdRecipePost`, `deleteOneApiHouseholdsShoppingListsItemIdDelete`.
- Produces:
  - `type BuildSelection = { recipeId: string; recipeIncrementQuantity: number }`
  - `type BuildResult = { listId: string; partial: boolean }`
  - `buildShoppingList(args: { name: string; selections: BuildSelection[] }): Promise<BuildResult>` (exported plain async fn, so it's unit-testable and reusable; the dialog calls it).

State machine: create list → bulk add. On add failure, fetch the new list; if it has items → return `{ listId, partial: true }`; if empty → best-effort delete (swallow) then throw. Caller disables confirm while pending and only retries the whole op after this resolves/rejects.

- [ ] **Step 1: Write the failing test (append)**

```ts
// append to src/hooks/useShoppingMutations.test.ts
import { buildShoppingList } from "./useShoppingMutations"

const sdk2 = sdk as unknown as Record<string, ReturnType<typeof vi.fn>>

describe("buildShoppingList", () => {
  beforeEach(() => vi.clearAllMocks())

  it("creates a list then bulk-adds recipes; returns the new list id", async () => {
    sdk2.createOneApiHouseholdsShoppingListsPost = vi.fn().mockResolvedValue({ data: { id: "new1" } })
    sdk2.addRecipeIngredientsToListApiHouseholdsShoppingListsItemIdRecipePost = vi.fn().mockResolvedValue({ data: {} })
    const res = await buildShoppingList({ name: "Shop · X", selections: [{ recipeId: "r1", recipeIncrementQuantity: 1.5 }] })
    expect(res).toEqual({ listId: "new1", partial: false })
    expect(sdk2.createOneApiHouseholdsShoppingListsPost).toHaveBeenCalledWith({ body: { name: "Shop · X" } })
    expect(sdk2.addRecipeIngredientsToListApiHouseholdsShoppingListsItemIdRecipePost).toHaveBeenCalledWith({
      path: { item_id: "new1" },
      body: [{ recipeId: "r1", recipeIncrementQuantity: 1.5 }],
    })
  })

  it("on add failure with an empty list, deletes it (best-effort) and throws", async () => {
    sdk2.createOneApiHouseholdsShoppingListsPost = vi.fn().mockResolvedValue({ data: { id: "new2" } })
    sdk2.addRecipeIngredientsToListApiHouseholdsShoppingListsItemIdRecipePost = vi.fn().mockRejectedValue(new Error("boom"))
    sdk2.getOneApiHouseholdsShoppingListsItemIdGet = vi.fn().mockResolvedValue({ data: { id: "new2", listItems: [] } })
    sdk2.deleteOneApiHouseholdsShoppingListsItemIdDelete = vi.fn().mockResolvedValue({ data: {} })
    await expect(buildShoppingList({ name: "Shop · Y", selections: [{ recipeId: "r1", recipeIncrementQuantity: 1 }] })).rejects.toThrow()
    expect(sdk2.deleteOneApiHouseholdsShoppingListsItemIdDelete).toHaveBeenCalledWith({ path: { item_id: "new2" } })
  })

  it("on add failure with a non-empty list, keeps it and returns partial", async () => {
    sdk2.createOneApiHouseholdsShoppingListsPost = vi.fn().mockResolvedValue({ data: { id: "new3" } })
    sdk2.addRecipeIngredientsToListApiHouseholdsShoppingListsItemIdRecipePost = vi.fn().mockRejectedValue(new Error("partial"))
    sdk2.getOneApiHouseholdsShoppingListsItemIdGet = vi.fn().mockResolvedValue({ data: { id: "new3", listItems: [{ id: "x" }] } })
    const res = await buildShoppingList({ name: "Shop · Z", selections: [{ recipeId: "r1", recipeIncrementQuantity: 1 }] })
    expect(res).toEqual({ listId: "new3", partial: true })
  })
})
```

> Add the new SDK fns to the `vi.mock("../api/generated/sdk.gen", …)` factory at the top of the file: `createOneApiHouseholdsShoppingListsPost`, `addRecipeIngredientsToListApiHouseholdsShoppingListsItemIdRecipePost`, `getOneApiHouseholdsShoppingListsItemIdGet`, `deleteOneApiHouseholdsShoppingListsItemIdDelete` (all `vi.fn()`).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/hooks/useShoppingMutations.test.ts`
Expected: FAIL — `buildShoppingList` not exported.

- [ ] **Step 3: Add the implementation (append to `src/hooks/useShoppingMutations.ts`)**

```ts
import {
  addRecipeIngredientsToListApiHouseholdsShoppingListsItemIdRecipePost,
  createOneApiHouseholdsShoppingListsPost,
  deleteOneApiHouseholdsShoppingListsItemIdDelete,
  getOneApiHouseholdsShoppingListsItemIdGet,
} from "../api/generated"

export type BuildSelection = { recipeId: string; recipeIncrementQuantity: number }
export type BuildResult = { listId: string; partial: boolean }

export async function buildShoppingList(args: {
  name: string
  selections: BuildSelection[]
}): Promise<BuildResult> {
  const created = await createOneApiHouseholdsShoppingListsPost({ body: { name: args.name } })
  const listId = created.data?.id
  if (!listId) throw new Error("Could not create shopping list")

  try {
    await addRecipeIngredientsToListApiHouseholdsShoppingListsItemIdRecipePost({
      path: { item_id: listId },
      body: args.selections,
    })
    return { listId, partial: false }
  } catch (addError) {
    // Ambiguous failure: did anything land? Inspect the new list.
    let hasItems = false
    try {
      const check = await getOneApiHouseholdsShoppingListsItemIdGet({ path: { item_id: listId } })
      hasItems = (check.data?.listItems?.length ?? 0) > 0
    } catch {
      hasItems = false
    }
    if (hasItems) return { listId, partial: true }
    // Empty → best-effort cleanup, then surface the error.
    try {
      await deleteOneApiHouseholdsShoppingListsItemIdDelete({ path: { item_id: listId } })
    } catch {
      // swallow; caller's message notes a stray empty list may remain
    }
    throw addError
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/hooks/useShoppingMutations.test.ts && pnpm type-check`
Expected: PASS; type-check clean.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useShoppingMutations.ts src/hooks/useShoppingMutations.test.ts
git commit -m "feat(shopping): build list create-and-add state machine"
```

---

## Task 6: Component — ShoppingListItemRow

**Files:**
- Create: `src/components/ShoppingListItemRow.tsx`
- Test: `src/components/ShoppingListItemRow.test.tsx`

**Interfaces:**
- Consumes: `ShoppingListItemOutOutput`.
- Produces: `<ShoppingListItemRow item onToggle onDelete disabled />` — props `{ item: ShoppingListItemOutOutput; onToggle: () => void; onDelete: () => void; disabled?: boolean }`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ShoppingListItemRow.test.tsx
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { render, screen } from "../test/render"
import { ShoppingListItemRow } from "./ShoppingListItemRow"

const base = { id: "i1", shoppingListId: "l1", display: "2 eggs", checked: false } as never

describe("ShoppingListItemRow", () => {
  it("renders the item display text", () => {
    render(<ShoppingListItemRow item={base} onToggle={() => {}} onDelete={() => {}} />)
    expect(screen.getByText("2 eggs")).toBeInTheDocument()
  })
  it("calls onToggle when the row is tapped", async () => {
    const onToggle = vi.fn()
    render(<ShoppingListItemRow item={base} onToggle={onToggle} onDelete={() => {}} />)
    await userEvent.click(screen.getByRole("button", { name: /2 eggs/i }))
    expect(onToggle).toHaveBeenCalledOnce()
  })
  it("shows checked styling via aria-label when checked", () => {
    render(<ShoppingListItemRow item={{ ...base, checked: true }} onToggle={() => {}} onDelete={() => {}} />)
    expect(screen.getByRole("button", { name: /checked/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/ShoppingListItemRow.test.tsx`
Expected: FAIL — cannot find module `./ShoppingListItemRow`.

- [ ] **Step 3: Write the implementation** (mirrors `IngredientCheckbox` tap-target/checked styling)

```tsx
// src/components/ShoppingListItemRow.tsx
import { mdiCheck, mdiClose } from "@mdi/js"
import Icon from "@mdi/react"
import type { ShoppingListItemOutOutput } from "../api/generated"

export function ShoppingListItemRow({
  item,
  onToggle,
  onDelete,
  disabled,
}: {
  item: ShoppingListItemOutOutput
  onToggle: () => void
  onDelete: () => void
  disabled?: boolean
}) {
  const checked = item.checked ?? false
  const label = item.display ?? item.note ?? "Item"
  return (
    <li className="group flex items-center border-gray-800 border-t last:border-b">
      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        aria-label={`${label}${checked ? ", checked" : ""}`}
        className="flex min-h-12 flex-1 cursor-pointer items-center gap-3 py-3 text-left transition-colors hover:text-gray-200 disabled:opacity-60"
      >
        <span
          className={`flex size-6 shrink-0 items-center justify-center rounded-full border ${
            checked ? "border-green-600 bg-green-600/20 text-green-500" : "border-gray-600 text-transparent"
          }`}
        >
          <Icon path={mdiCheck} size={0.6} aria-hidden />
        </span>
        <span className={`min-w-0 flex-1 ${checked ? "text-gray-500 line-through opacity-75" : "text-gray-200"}`}>
          {label}
        </span>
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Remove ${label}`}
        className="ml-2 hidden size-10 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:text-gray-300 group-hover:flex"
      >
        <Icon path={mdiClose} size={0.7} aria-hidden />
      </button>
    </li>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/ShoppingListItemRow.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ShoppingListItemRow.tsx src/components/ShoppingListItemRow.test.tsx
git commit -m "feat(shopping): item row component (cook-mode check-off styling)"
```

---

## Task 7: Component — ShoppingListView

**Files:**
- Create: `src/components/ShoppingListView.tsx`
- Test: `src/components/ShoppingListView.test.tsx`

**Interfaces:**
- Consumes: `useShoppingListDetail` (Task 3); `useToggleItem`, `useAddManualItem`, `useDeleteItem` (Task 4); `groupItemsByAisle` (Task 2); `ShoppingListItemRow` (Task 6).
- Produces: `<ShoppingListView listId={string} />`. Renders aisle groups, a manual-add input, and a completed state when all items are checked.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ShoppingListView.test.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it } from "vitest"
import { shoppingListDetailQueryOptions } from "../hooks/useShoppingList"
import { ShoppingListView } from "./ShoppingListView"

function wrap(seed: unknown) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  qc.setQueryData(shoppingListDetailQueryOptions("l1").queryKey, seed)
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe("ShoppingListView", () => {
  it("groups items under aisle headings", () => {
    const seed = {
      id: "l1",
      listItems: [
        { id: "a", shoppingListId: "l1", display: "Milk", checked: false, labelId: "dairy", label: { id: "dairy", name: "Dairy", groupId: "g" } },
      ],
      labelSettings: [{ id: "s", shoppingListId: "l1", labelId: "dairy", position: 0, label: { id: "dairy", name: "Dairy", groupId: "g" } }],
    }
    render(<ShoppingListView listId="l1" />, { wrapper: wrap(seed) })
    expect(screen.getByText("Dairy")).toBeInTheDocument()
    expect(screen.getByText("Milk")).toBeInTheDocument()
  })

  it("shows a completed state when every item is checked", () => {
    const seed = {
      id: "l1",
      listItems: [{ id: "a", shoppingListId: "l1", display: "Milk", checked: true }],
      labelSettings: [],
    }
    render(<ShoppingListView listId="l1" />, { wrapper: wrap(seed) })
    expect(screen.getByText(/all done/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/ShoppingListView.test.tsx`
Expected: FAIL — cannot find module `./ShoppingListView`.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/ShoppingListView.tsx
import { useState } from "react"
import { useShoppingListDetail } from "../hooks/useShoppingList"
import { useAddManualItem, useDeleteItem, useToggleItem } from "../hooks/useShoppingMutations"
import { groupItemsByAisle } from "../utils/shopping"
import { ShoppingListItemRow } from "./ShoppingListItemRow"

export function ShoppingListView({ listId }: { listId: string }) {
  const { data: list, isLoading } = useShoppingListDetail(listId)
  const { toggle, pendingIds } = useToggleItem(listId)
  const { add } = useAddManualItem(listId)
  const { remove } = useDeleteItem(listId)
  const [draft, setDraft] = useState("")

  if (isLoading || !list) return <p className="p-6 text-gray-500">Loading…</p>

  const items = list.listItems ?? []
  const groups = groupItemsByAisle(items, list.labelSettings ?? [])
  const allChecked = items.length > 0 && items.every((i) => i.checked)

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24">
      <form
        className="sticky top-0 z-10 flex gap-2 bg-gray-950 py-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!draft.trim()) return
          add(draft)
          setDraft("")
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add an item…"
          aria-label="Add an item"
          className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100"
        />
        <button type="submit" className="rounded-lg bg-orange-600 px-4 py-2 font-medium text-white hover:bg-orange-500">
          Add
        </button>
      </form>

      {allChecked && (
        <p className="rounded-lg bg-green-900/30 px-4 py-3 text-green-300">All done — everything's checked off. 🎉</p>
      )}

      {groups.map((group) => (
        <section key={group.labelId ?? "none"} className="mt-5">
          <h2 className="mb-1 font-semibold text-gray-400 text-sm uppercase tracking-wide">{group.name}</h2>
          <ul>
            {group.items.map((item) => (
              <ShoppingListItemRow
                key={item.id}
                item={item}
                disabled={pendingIds.has(item.id)}
                onToggle={() => toggle(item)}
                onDelete={() => remove(item.id)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/ShoppingListView.test.tsx && pnpm type-check`
Expected: PASS; type-check clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/ShoppingListView.tsx src/components/ShoppingListView.test.tsx
git commit -m "feat(shopping): list view (aisle groups, manual add, completed state)"
```

---

## Task 8: Route `/shopping` + nav entry

**Files:**
- Create: `src/routes/shopping.tsx`
- Modify: `src/components/UserMenu.tsx`
- Test: `src/components/UserMenu.test.tsx` (extend)

**Interfaces:**
- Consumes: `fetchCurrentUser` (`src/api/auth`); `configureApiClient` (`src/api/client`); `useCurrentShoppingList` (Task 3); `ShoppingListView` (Task 7).
- Produces: `/shopping` route (guarded; reads `?list=<id>` to open a specific list, else current); a "Shopping" link in `UserMenu`.

- [ ] **Step 1: Write the failing test (UserMenu shows Shopping when authed)**

```tsx
// extend src/components/UserMenu.test.tsx — add inside the authed test (user not anonymous)
// After rendering UserMenu with { user: {...}, isAnonymous: false }:
//   expect(await screen.findByRole("link", { name: /shopping/i })).toHaveAttribute("href", "/shopping")
```

Add an assertion to the existing "shows Meal Plan + Sign out when authed" test:
```tsx
expect(screen.getByRole("link", { name: /shopping/i })).toHaveAttribute("href", "/shopping")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/UserMenu.test.tsx`
Expected: FAIL — no "Shopping" link.

- [ ] **Step 3: Add the Shopping link to `UserMenu.tsx`**

Insert before the "Meal Plan" `<a>` (inside the authed `<div className="flex items-center gap-2">`):
```tsx
<a
  href="/shopping"
  className="rounded-lg bg-gray-800 px-3 py-1.5 font-medium text-gray-200 text-sm transition-colors hover:bg-gray-700"
>
  Shopping
</a>
```

- [ ] **Step 4: Create the `/shopping` route**

```tsx
// src/routes/shopping.tsx
import { createFileRoute, redirect } from "@tanstack/react-router"
import { fetchCurrentUser } from "../api/auth"
import { configureApiClient } from "../api/client"
import { ShoppingListView } from "../components/ShoppingListView"
import { useCurrentShoppingList } from "../hooks/useShoppingList"

type ShoppingSearch = { list?: string }

export const Route = createFileRoute("/shopping")({
  head: () => ({ meta: [{ title: "Shopping · Manaaki" }] }),
  validateSearch: (s: Record<string, unknown>): ShoppingSearch => ({
    list: typeof s.list === "string" ? s.list : undefined,
  }),
  beforeLoad: async () => {
    configureApiClient()
    const { isAnonymous } = await fetchCurrentUser()
    if (isAnonymous) throw redirect({ href: "/api/auth/oauth" })
  },
  component: ShoppingPage,
})

function ShoppingPage() {
  const { list: listParam } = Route.useSearch()
  const current = useCurrentShoppingList()
  const listId = listParam ?? current?.id

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <div className="mx-auto max-w-2xl px-4 pt-5">
        <h1 className="font-bold text-2xl">Shopping</h1>
      </div>
      {listId ? (
        <ShoppingListView listId={listId} />
      ) : current === null ? (
        <p className="mx-auto max-w-2xl px-4 py-10 text-gray-400">
          No shopping list yet — build one from your meal plan.
        </p>
      ) : (
        <p className="mx-auto max-w-2xl px-4 py-10 text-gray-500">Loading…</p>
      )}
    </main>
  )
}
```

- [ ] **Step 5: Verify route tree + tests**

Run: `pnpm dev` briefly (regenerates `src/routeTree.gen.ts`), stop it, then `pnpm type-check && pnpm vitest run src/components/UserMenu.test.tsx`
Expected: `/shopping` in `routeTree.gen.ts`; type-check clean; UserMenu test passes.

- [ ] **Step 6: Commit**

```bash
git add src/routes/shopping.tsx src/components/UserMenu.tsx src/components/UserMenu.test.tsx src/routeTree.gen.ts
git commit -m "feat(shopping): /shopping route (guarded, current/opened list) + nav link"
```

---

## Task 9: Component — BuildShoppingListDialog

**Files:**
- Create: `src/components/BuildShoppingListDialog.tsx`
- Test: `src/components/BuildShoppingListDialog.test.tsx`

**Interfaces:**
- Consumes: `shoppingDayRange`, `gatherPlanRecipes`, `computeRecipeIncrement` (Tasks 1–2); `mealPlanQueryOptions`, `todayIsoDateString` (`../hooks/useMealPlan`); `buildShoppingList` (Task 5); `useQueryClient`/`useQuery`.
- Produces: `<BuildShoppingListDialog open onClose onBuilt />` — `onBuilt(result: { listId: string; partial: boolean })`. Internally: day picker (3/4/5/7) → fetch own range → review (checkbox + servings stepper per recipe) → confirm.

Default review state per recipe: included = true; servings mode when `baseServings != null && > 0` (default value = `baseServings * occurrences`), else multiplier mode (default value = `occurrences`). Selection scale = `computeRecipeIncrement({ mode, value, baseServings })`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/BuildShoppingListDialog.test.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import userEvent from "@testing-library/user-event"
import { render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import * as planHook from "../hooks/useMealPlan"
import * as mutations from "../hooks/useShoppingMutations"
import { BuildShoppingListDialog } from "./BuildShoppingListDialog"

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe("BuildShoppingListDialog", () => {
  beforeEach(() => vi.restoreAllMocks())

  it("picks days, reviews planned recipes, and builds with scaled selections", async () => {
    vi.spyOn(planHook, "mealPlanQueryOptions").mockReturnValue({
      queryKey: ["mealplan", "x"],
      queryFn: async () => [
        { date: "2026-06-28", id: 1, groupId: "g", userId: "u", householdId: "h", recipeId: "r1", recipe: { id: "r1", name: "Soup", recipeServings: 4 } },
      ],
    } as never)
    const build = vi.spyOn(mutations, "buildShoppingList").mockResolvedValue({ listId: "new1", partial: false })
    const onBuilt = vi.fn()

    render(<BuildShoppingListDialog open onClose={() => {}} onBuilt={onBuilt} />, { wrapper: wrap() })

    await userEvent.click(screen.getByRole("button", { name: /next 4 days/i }))
    expect(await screen.findByText("Soup")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /create list/i }))

    await waitFor(() => expect(build).toHaveBeenCalled())
    const arg = build.mock.calls[0][0]
    expect(arg.selections).toEqual([{ recipeId: "r1", recipeIncrementQuantity: 1 }])
    await waitFor(() => expect(onBuilt).toHaveBeenCalledWith({ listId: "new1", partial: false }))
  })

  it("shows an empty state when no recipes are planned in range", async () => {
    vi.spyOn(planHook, "mealPlanQueryOptions").mockReturnValue({
      queryKey: ["mealplan", "y"],
      queryFn: async () => [],
    } as never)
    render(<BuildShoppingListDialog open onClose={() => {}} onBuilt={() => {}} />, { wrapper: wrap() })
    await userEvent.click(screen.getByRole("button", { name: /next 5 days/i }))
    expect(await screen.findByText(/nothing planned/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/BuildShoppingListDialog.test.tsx`
Expected: FAIL — cannot find module `./BuildShoppingListDialog`.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/BuildShoppingListDialog.tsx
import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { mealPlanQueryOptions, todayIsoDateString } from "../hooks/useMealPlan"
import { buildShoppingList } from "../hooks/useShoppingMutations"
import { computeRecipeIncrement, gatherPlanRecipes, shoppingDayRange } from "../utils/shopping"

const DAY_OPTIONS = [3, 4, 5, 7]

type Row = { recipeId: string; name: string; baseServings: number | null; occurrences: number; included: boolean; value: number }

export function BuildShoppingListDialog({
  open,
  onClose,
  onBuilt,
}: {
  open: boolean
  onClose: () => void
  onBuilt: (result: { listId: string; partial: boolean }) => void
}) {
  const [days, setDays] = useState<number | null>(null)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [building, setBuilding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const range = useMemo(
    () => (days ? shoppingDayRange(new Date(), days) : null),
    [days]
  )
  const { data: entries } = useQuery({
    ...mealPlanQueryOptions(range?.start ?? "", range?.end ?? ""),
    enabled: Boolean(range),
  })

  // Seed review rows once entries for the chosen range arrive.
  const gathered = useMemo(() => (entries ? gatherPlanRecipes(entries) : null), [entries])
  if (gathered && rows === null && days) {
    setRows(
      gathered.map((g) => ({
        ...g,
        included: true,
        value: g.baseServings && g.baseServings > 0 ? g.baseServings * g.occurrences : g.occurrences,
      }))
    )
  }

  if (!open) return null

  function pick(n: number) {
    setRows(null)
    setError(null)
    setDays(n)
  }

  async function confirm() {
    if (!rows) return
    const selections = rows
      .filter((r) => r.included)
      .map((r) => ({
        recipeId: r.recipeId,
        recipeIncrementQuantity: computeRecipeIncrement({
          mode: r.baseServings && r.baseServings > 0 ? "servings" : "multiplier",
          value: r.value,
          baseServings: r.baseServings,
        }),
      }))
    if (selections.length === 0) return
    setBuilding(true)
    setError(null)
    try {
      const result = await buildShoppingList({
        name: range ? `Shop · ${range.start}–${range.end}` : "Shopping list",
        selections,
      })
      onBuilt(result)
    } catch {
      setError("Couldn't build the list. A stray empty list may remain — you can remove it in Mealie. Try again.")
    } finally {
      setBuilding(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-lg rounded-t-2xl bg-gray-900 p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold text-gray-100 text-lg">Build shopping list</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-200">Close</button>
        </div>

        <div className="mb-4 flex gap-2">
          {DAY_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => pick(n)}
              className={`rounded-full px-3 py-1.5 font-medium text-sm ${days === n ? "bg-orange-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}
            >
              Next {n} days
            </button>
          ))}
        </div>

        {days && rows === null && <p className="text-gray-500">Loading plan…</p>}
        {rows !== null && rows.length === 0 && (
          <p className="text-gray-400">Nothing planned with a recipe in the next {days} days.</p>
        )}

        {rows && rows.length > 0 && (
          <ul className="max-h-80 overflow-y-auto">
            {rows.map((r, idx) => (
              <li key={r.recipeId} className="flex items-center gap-3 border-gray-800 border-t py-3">
                <input
                  type="checkbox"
                  checked={r.included}
                  aria-label={`Include ${r.name}`}
                  onChange={(e) => setRows(rows.map((x, i) => (i === idx ? { ...x, included: e.target.checked } : x)))}
                  className="size-5"
                />
                <span className="min-w-0 flex-1 text-gray-200">{r.name}</span>
                <label className="flex items-center gap-1 text-gray-400 text-sm">
                  {r.baseServings && r.baseServings > 0 ? "servings" : "×"}
                  <input
                    type="number"
                    min={1}
                    value={r.value}
                    aria-label={`${r.baseServings && r.baseServings > 0 ? "Servings" : "Multiplier"} for ${r.name}`}
                    onChange={(e) =>
                      setRows(rows.map((x, i) => (i === idx ? { ...x, value: Number(e.target.value) || 1 } : x)))
                    }
                    className="w-16 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                  />
                </label>
              </li>
            ))}
          </ul>
        )}

        {error && <p className="mt-3 text-red-400 text-sm">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-gray-300 hover:text-gray-100">
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={building || !rows || rows.filter((r) => r.included).length === 0}
            className="rounded-lg bg-orange-600 px-4 py-2 font-medium text-white hover:bg-orange-500 disabled:opacity-50"
          >
            {building ? "Creating…" : "Create list"}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/BuildShoppingListDialog.test.tsx && pnpm type-check`
Expected: PASS; type-check clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/BuildShoppingListDialog.tsx src/components/BuildShoppingListDialog.test.tsx
git commit -m "feat(shopping): build dialog (day picker, review, servings, confirm)"
```

---

## Task 10: Wire the builder into `/shopping` and `/plan`

**Files:**
- Modify: `src/routes/shopping.tsx`
- Modify: `src/routes/plan.tsx`

**Interfaces:**
- Consumes: `BuildShoppingListDialog` (Task 9); `useNavigate` from `@tanstack/react-router`.
- Produces: a "Build shopping list" button on both pages that opens the dialog; on `onBuilt`, navigate to `/shopping?list=<id>` and (on `/shopping`) refetch current.

- [ ] **Step 1: Add the trigger + dialog to `/shopping`** (`ShoppingPage`)

```tsx
// in src/routes/shopping.tsx — add imports
import { useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { BuildShoppingListDialog } from "../components/BuildShoppingListDialog"

// inside ShoppingPage, before return:
const navigate = useNavigate()
const [buildOpen, setBuildOpen] = useState(false)

// in the header div, next to <h1>:
<button
  type="button"
  onClick={() => setBuildOpen(true)}
  className="rounded-lg bg-orange-600 px-3 py-1.5 font-medium text-sm text-white hover:bg-orange-500"
>
  Build shopping list
</button>

// before </main>:
<BuildShoppingListDialog
  open={buildOpen}
  onClose={() => setBuildOpen(false)}
  onBuilt={({ listId }) => {
    setBuildOpen(false)
    navigate({ to: "/shopping", search: { list: listId } })
  }}
/>
```

- [ ] **Step 2: Add the trigger + dialog to `/plan`** (`PlanPage` header toolbar — the right `<div className="flex items-center gap-2">`)

```tsx
// in src/routes/plan.tsx — add imports (useState already used in file? add if missing)
import { BuildShoppingListDialog } from "../components/BuildShoppingListDialog"
import { useNavigate } from "@tanstack/react-router"

// inside PlanPage, near other state:
const navigate = useNavigate()
const [buildOpen, setBuildOpen] = useState(false)

// add a button before the "Load future week" button:
<button
  type="button"
  onClick={() => setBuildOpen(true)}
  className="rounded-full bg-gray-800 px-3 py-1.5 font-medium text-gray-300 text-sm transition-colors hover:bg-gray-700"
>
  Build shopping list
</button>

// before the component's closing </main>:
<BuildShoppingListDialog
  open={buildOpen}
  onClose={() => setBuildOpen(false)}
  onBuilt={({ listId }) => {
    setBuildOpen(false)
    navigate({ to: "/shopping", search: { list: listId } })
  }}
/>
```

- [ ] **Step 3: Verify**

Run: `pnpm type-check && pnpm test`
Expected: type-check clean; full suite passes.

- [ ] **Step 4: Commit**

```bash
git add src/routes/shopping.tsx src/routes/plan.tsx
git commit -m "feat(shopping): launch build dialog from /shopping and /plan"
```

---

## Task 11: Add-from-recipe button

**Files:**
- Create: `src/components/AddToShoppingListButton.tsx`
- Create: `src/components/AddToShoppingListButton.test.tsx`
- Modify: `src/components/RecipeHeader.tsx`

**Interfaces:**
- Consumes: `useCurrentUser` (`../hooks/useCurrentUser`); `useCurrentShoppingList` (Task 3); `buildShoppingList` (Task 5) for the no-list case; SDK `addRecipeIngredientsToListApiHouseholdsShoppingListsItemIdRecipePost`; `RecipeOutput`.
- Produces: `<AddToShoppingListButton recipe={RecipeOutput} />`. Anonymous → a "Sign in to add" link to `/api/auth/oauth`. Authed → adds the recipe (×1) to the current list, creating one if none.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/AddToShoppingListButton.test.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import * as currentUser from "../hooks/useCurrentUser"
import * as shoppingList from "../hooks/useShoppingList"
import * as sdk from "../api/generated/sdk.gen"
import { AddToShoppingListButton } from "./AddToShoppingListButton"

vi.mock("../api/generated/sdk.gen", () => ({
  addRecipeIngredientsToListApiHouseholdsShoppingListsItemIdRecipePost: vi.fn().mockResolvedValue({ data: {} }),
}))

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}
const recipe = { id: "r1", name: "Soup", recipeServings: 4 } as never

describe("AddToShoppingListButton", () => {
  beforeEach(() => vi.restoreAllMocks())

  it("shows a sign-in CTA when anonymous", () => {
    vi.spyOn(currentUser, "useCurrentUser").mockReturnValue({ user: null, isAnonymous: true })
    render(<AddToShoppingListButton recipe={recipe} />, { wrapper: wrap() })
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/api/auth/oauth")
  })

  it("adds the recipe to the current list when authed", async () => {
    vi.spyOn(currentUser, "useCurrentUser").mockReturnValue({ user: { id: "u" }, isAnonymous: false } as never)
    vi.spyOn(shoppingList, "useCurrentShoppingList").mockReturnValue({ id: "l1" } as never)
    const { default: userEvent } = await import("@testing-library/user-event")
    render(<AddToShoppingListButton recipe={recipe} />, { wrapper: wrap() })
    await userEvent.click(screen.getByRole("button", { name: /add to shopping list/i }))
    await waitFor(() =>
      expect(sdk.addRecipeIngredientsToListApiHouseholdsShoppingListsItemIdRecipePost).toHaveBeenCalledWith({
        path: { item_id: "l1" },
        body: [{ recipeId: "r1", recipeIncrementQuantity: 1 }],
      })
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/AddToShoppingListButton.test.tsx`
Expected: FAIL — cannot find module `./AddToShoppingListButton`.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/AddToShoppingListButton.tsx
import { mdiCartPlus } from "@mdi/js"
import Icon from "@mdi/react"
import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { addRecipeIngredientsToListApiHouseholdsShoppingListsItemIdRecipePost, type RecipeOutput } from "../api/generated"
import { useCurrentUser } from "../hooks/useCurrentUser"
import { currentListQueryOptions, useCurrentShoppingList } from "../hooks/useShoppingList"
import { buildShoppingList } from "../hooks/useShoppingMutations"

const BTN = "inline-flex min-h-11 items-center gap-1.5 rounded-full bg-black/40 px-4 py-2 font-medium text-sm text-white backdrop-blur-sm transition-colors hover:bg-black/60"

export function AddToShoppingListButton({ recipe }: { recipe: RecipeOutput }) {
  const current = useCurrentUser()
  const list = useCurrentShoppingList()
  const qc = useQueryClient()
  const [state, setState] = useState<"idle" | "adding" | "done" | "error">("idle")

  if (!current || current.isAnonymous) {
    return (
      <a href="/api/auth/oauth" className={BTN}>
        <Icon path={mdiCartPlus} size={0.75} aria-hidden /> Sign in to add
      </a>
    )
  }

  async function add() {
    if (!recipe.id) return
    setState("adding")
    try {
      let listId = list?.id
      if (!listId) {
        const built = await buildShoppingList({ name: "Shopping list", selections: [{ recipeId: recipe.id, recipeIncrementQuantity: 1 }] })
        listId = built.listId
      } else {
        await addRecipeIngredientsToListApiHouseholdsShoppingListsItemIdRecipePost({
          path: { item_id: listId },
          body: [{ recipeId: recipe.id, recipeIncrementQuantity: 1 }],
        })
      }
      qc.invalidateQueries({ queryKey: currentListQueryOptions.queryKey })
      setState("done")
    } catch {
      setState("error")
    }
  }

  return (
    <button type="button" onClick={add} disabled={state === "adding"} className={BTN} aria-label="Add to shopping list">
      <Icon path={mdiCartPlus} size={0.75} aria-hidden />
      {state === "done" ? "Added" : state === "error" ? "Try again" : "Add to shopping list"}
    </button>
  )
}
```

- [ ] **Step 4: Render it in `RecipeHeader.tsx`** — in the top-right cluster, before `<ShareRecipeButton recipe={recipe} />`:

```tsx
import { AddToShoppingListButton } from "./AddToShoppingListButton"
// ...
<AddToShoppingListButton recipe={recipe} />
```

- [ ] **Step 5: Run tests + type-check**

Run: `pnpm vitest run src/components/AddToShoppingListButton.test.tsx && pnpm type-check`
Expected: PASS; type-check clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/AddToShoppingListButton.tsx src/components/AddToShoppingListButton.test.tsx src/components/RecipeHeader.tsx
git commit -m "feat(shopping): add-to-list button on recipe pages (anonymous sign-in CTA)"
```

---

## Task 12: Previous-lists history view

**Files:**
- Create: `src/components/ShoppingListHistory.tsx`
- Create: `src/components/ShoppingListHistory.test.tsx`
- Modify: `src/routes/shopping.tsx`

**Interfaces:**
- Consumes: `shoppingHistoryQueryOptions` (Task 3); `useNavigate`.
- Produces: `<ShoppingListHistory currentId={string | undefined} />` — a list of previous lists (excluding `currentId`), each linking to `/shopping?list=<id>`; visually marks which is current.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ShoppingListHistory.test.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import * as sdk from "../api/generated/sdk.gen"
import { ShoppingListHistory } from "./ShoppingListHistory"

vi.mock("../api/generated/sdk.gen", () => ({ getAllApiHouseholdsShoppingListsGet: vi.fn() }))

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe("ShoppingListHistory", () => {
  beforeEach(() => vi.clearAllMocks())
  it("lists previous lists with links to open them", async () => {
    vi.mocked(sdk.getAllApiHouseholdsShoppingListsGet).mockResolvedValue({
      data: { items: [{ id: "l1", name: "Shop · A" }, { id: "l2", name: "Shop · B" }] },
    } as never)
    render(<ShoppingListHistory currentId="l1" />, { wrapper: wrap() })
    const link = await screen.findByRole("link", { name: /Shop · B/i })
    expect(link).toHaveAttribute("href", expect.stringContaining("list=l2"))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/ShoppingListHistory.test.tsx`
Expected: FAIL — cannot find module `./ShoppingListHistory`.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/ShoppingListHistory.tsx
import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { shoppingHistoryQueryOptions } from "../hooks/useShoppingList"

export function ShoppingListHistory({ currentId }: { currentId: string | undefined }) {
  const { data: lists } = useQuery(shoppingHistoryQueryOptions(1))
  const previous = (lists ?? []).filter((l) => l.id !== currentId)
  if (previous.length === 0) return null
  return (
    <section className="mx-auto max-w-2xl px-4 pt-8">
      <h2 className="mb-2 font-semibold text-gray-400 text-sm uppercase tracking-wide">Previous lists</h2>
      <ul className="divide-y divide-gray-800">
        {previous.map((l) => (
          <li key={l.id}>
            <Link to="/shopping" search={{ list: l.id }} className="block py-3 text-gray-300 hover:text-gray-100">
              {l.name ?? "Untitled list"}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
```

- [ ] **Step 4: Wire into `/shopping`** — render below the list view, and mark the opened list as distinct from current:

```tsx
// in ShoppingPage, after the list block:
<ShoppingListHistory currentId={current?.id} />
// and import it at the top:
import { ShoppingListHistory } from "../components/ShoppingListHistory"
```
Also, when `listParam && listParam !== current?.id`, show a small "Viewing a previous list" banner above `ShoppingListView` so users know it's not current:
```tsx
{listParam && listParam !== current?.id && (
  <p className="mx-auto max-w-2xl px-4 text-amber-400 text-sm">Viewing a previous list.</p>
)}
```

- [ ] **Step 5: Run tests + type-check**

Run: `pnpm vitest run src/components/ShoppingListHistory.test.tsx && pnpm type-check`
Expected: PASS; type-check clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/ShoppingListHistory.tsx src/components/ShoppingListHistory.test.tsx src/routes/shopping.tsx
git commit -m "feat(shopping): previous-lists history (URL-addressable, distinct from current)"
```

---

## Task 13: Full validation + manual E2E

**Files:** none (verification only)

- [ ] **Step 1: Whole suite + lint + type-check + build**

Run: `pnpm validate && pnpm test && pnpm build`
Expected: type-check, biome, all vitest tests, and the production build all pass.

- [ ] **Step 2: Manual E2E (against the live/staging stack, logged in)**

Verify:
- `/shopping` shows current list (or empty state); items grouped by aisle; check-off persists and survives refresh; manual add + delete work.
- Rapid double-tap on one item doesn't double-toggle.
- From `/plan` (and `/shopping`): "Build shopping list" → next 5 days → review (uncheck one; bump a recipe's servings) → Create list → lands on the new list with scaled quantities.
- Recipe page "Add to shopping list" appends to the current list (and creates one if none); anonymous shows the sign-in CTA.
- Previous lists list shows older lists, opening one shows the "viewing a previous list" banner.

- [ ] **Step 3: Final commit (if any doc tweaks)**

```bash
git add -A && git commit -m "test: validate shopping-list builder end-to-end" || true
```

---

## Self-Review (completed during authoring)

- **Spec coverage:** current-list model + explicit sort (Task 3); authed gating + nav (Task 8); builder day-range `N−1` + own-range fetch + normalisation + duplicate aggregation + servings/multiplier (Tasks 1–2, 9); create-and-add state machine + half-fail cleanup (Task 5); aisle grouping by `labelSettings.position` (Tasks 2, 7); check-off explicit mapper + `find`/refetch reconcile + serialization (Tasks 2, 4); manual add/delete + completed/empty states (Tasks 4, 7); add-from-recipe bulk-single + anonymous CTA (Task 11); previous lists URL-addressable + distinct (Task 12); contract/edge tests throughout; validation (Task 13).
- **Placeholder scan:** none — every step has complete code.
- **Type consistency:** `GatheredRecipe`, `BuildSelection`/`BuildResult`, `buildShoppingList`, `useToggleItem`/`useAddManualItem`/`useDeleteItem`, `shoppingListDetailQueryOptions`/`currentListQueryOptions`/`shoppingHistoryQueryOptions`, `groupItemsByAisle`/`itemUpdateFromOutput`/`computeRecipeIncrement` are referenced consistently across tasks.
- **Implementer notes:** confirm the `OrderByNullPosition` literal (`"last"`) against `types.gen.ts` (Task 3); run `pnpm dev` once after adding `/shopping` so `routeTree.gen.ts` regenerates (Task 8); the `useShoppingMutations` test mock factory must list every SDK fn used across Tasks 4–5.
```
