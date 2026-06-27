# Shopping-list builder — design

Date: 2026-06-27
Revised: 2026-06-27 (incorporating two external reviews — API precision,
contract ambiguities, concurrency, and edge cases)

## Problem

manaaki now has an authenticated tier (per-user Mealie identity via the BFF). The
first feature to ride on it is a **shopping-list builder**: a nicer-than-Mealie
way to turn a meal plan into a shopping list and use it in the store. The user's
core workflow is "create a plan, then add the next few days (often 4 or 5) to a
shopping list," plus building lists recipe-by-recipe, plus checking items off
while shopping. Mealie's own multi-list management is the pain point to avoid.

Mealie already provides full shopping-list storage (lists, items with bulk
create, check-off, food labels/aisle ordering, and a server-side
"add a recipe's ingredients to a list" with a scale multiplier). So this is a
**manaaki UX feature on top of Mealie's API**, not new storage.

## Goals

- Build a shopping list from the plan: pick the next N days → review/adjust →
  create a new list.
- Per-recipe "add to shopping list" from recipe pages.
- A clean in-store experience: items grouped by aisle, big-touch check-off.
- Avoid multi-list management friction: always surface one **current** list;
  older lists stay out of the way but remain reachable.

## Non-goals (deferred)

- Editing arbitrary item quantities/labels inline (use Mealie for that).
- Reordering/customising aisle/label order from manaaki (use Mealie's settings).
- Sharing/printing lists; offline-first sync.
- Meal history feature (separate sub-project).

## Implementation constraints (repo-specific)

- The builder is entered from **both** `/plan` and `/shopping`, so its shared UI
  and utilities live in `src/components/` and `src/utils/` (or `src/hooks/`) —
  **not** inside route modules. Route files export only `Route`; route-dir test
  files need a leading `-` (e.g. `-foo.test.ts`) to avoid the
  "does not export a Route" SSR/module-runner warning (see `AGENTS.md`). (This
  bit us once in the auth foundation.)
- The generated client is built from `https://demo.mealie.io/openapi.json`
  (latest), not the deployed instance (which has `API_DOCS=False`). Record the
  deployed Mealie version and treat the contract-test items below as the guard
  against schema drift.

## Core model

- **Current list = the most recently created shopping list** for the household.
  Mealie's default list sort is by name, so request the current list explicitly
  and **separately from history**:
  `getAllApiHouseholdsShoppingListsGet({ orderBy: "createdAt", orderDirection: "desc", orderByNullPosition: "last", perPage: 1 })`
  → `items[0]` is current (or none). `createdAt` on `ShoppingListSummary` is
  `string | null | undefined`; `orderByNullPosition: "last"` keeps null-dated
  lists from masquerading as newest. History (previous lists) uses its own
  paginated query — don't fetch everything with `perPage: -1`.
- **Scope caveat (explicit):** Mealie shopping lists are **household-wide**
  (`ShoppingListOut` has both `userId` and `householdId`); "current = newest" is
  household-wide, so the newest wins regardless of which member created it.
  Acceptable for this small-family deployment; noted so it's not a surprise.
- **Building creates a new list**, which becomes current. **Per-recipe adds
  append to the current list** (creating one if none exists).
- **Authed-only.** Gated like `/plan`. `/api/households/shopping/*` is absent
  from the anonymous allowlist, so the BFF already 403s anonymous access
  (server-side enforcement; verified in `allowlist.ts` / `proxy.ts`).

## Components

### 1. Route, gating, nav

- New route **`/shopping`** (`src/routes/shopping.tsx`), `beforeLoad` guard
  mirroring `/plan`: `fetchCurrentUser()` →
  `throw redirect({ href: "/api/auth/oauth" })` when anonymous.
- Add a **"Shopping"** entry to `UserMenu` (next to "Meal Plan"), authed-only.

### 2. The builder: plan → new list (headline flow)

Entry: a **"Build shopping list"** action on both `/plan` and `/shopping`.

1. **Pick days** — quick options **next 3 / 4 / 5 / 7 days**, counting **today
   as day 1**.
2. **Fetch the exact range** with the builder's own mealplan query: `start_date =
   today`, `end_date = today + (N − 1)` (inclusive end → exactly N calendar
   dates; **not** `today + N`). Independent of the `/plan` page's loaded window.
3. **Gather + normalise recipes** from entries in range:
   - **Recipe id** = `entry.recipeId ?? entry.recipe?.id`. **Skip the entry only
     when no usable id exists** (covers free-text entries and the independently
     nullable `recipeId`/`recipe` shapes).
   - **Display name** = `entry.recipe?.name ?? entry.title ?? "Recipe"`.
   - **Missing recipe summary / `recipeServings`** → keep the entry but use
     **multiplier mode** (×1/×2…), don't drop it.
   - Include **all entry types** with a usable recipe (breakfast/lunch/dinner/
     side/…); nothing is hidden — everything appears on the review screen.
   - **Duplicate recipe in range** (same recipe planned twice): aggregate into a
     single review row showing the occurrence count, with default scale = the
     **sum of per-occurrence scales** (e.g. a 4-serving recipe planned twice =
     ×2). User can adjust. (Contract-tested — don't assume bulk merge behaviour.)
4. **Review screen** — each recipe row: a checkbox (checked by default; uncheck
   to exclude) and a **servings stepper** (default = base servings; multiplier
   mode when base is undefined or ≤ 0 — never divide by zero).
5. **Confirm** → the create-and-add state machine in *Error handling* below.

Day-range math, recipe normalisation, duplicate aggregation, and scale
computation are **pure functions** (unit-tested).

### 3. The shopping list view (in-store use)

`/shopping` shows the **current** list (detail fetch
`getOneApiHouseholdsShoppingListsItemIdGet`).

- **Aisle grouping (algorithmic):** group items by `item.label?.id`; order groups
  by the matching `labelSettings[].position` on the list; unlabelled / unknown
  groups go last. (These are aisle *labels*, distinct from recipe categories.)
- **Big touch-target check-off** (cook-mode visual language); checked items strike
  through and sink within their group.
- **Check-off mechanics (contract-precise):** `updateOneApiHouseholdsShoppingItemsItemIdPut`
  takes `ShoppingListItemUpdate` (requires `shoppingListId`; other fields
  optional). Do **not** spread the response object (`ShoppingListItemOutOutput`
  has response-only fields like `id`/`groupId`/`label`/timestamps). Instead use an
  explicit **output→update mapper** that copies only the accepted mutable fields
  (`shoppingListId`, `quantity`, `unit`, `food`/`foodId`, `note`, `display`,
  `position`, `isFood`, `labelId`, …) and flips `checked`. **Contract test**
  whether sending just `{ shoppingListId, checked }` preserves omitted fields; if
  it doesn't (PUT replaces), the mapper must send all accepted fields.
- **Reconcile safely:** the response is `ShoppingListItemsCollectionOut` whose
  `updatedItems`/`createdItems` are **optional**. Reconcile via
  `updatedItems?.find(i => i.id === targetId)`; if absent, invalidate/refetch the
  list. Same `find`-or-refetch pattern for manual creation (`createdItems`).
- **Mutation serialization:** check-off mutations are **serialized per item** so
  rapid toggles can't race the full-object PUT into an inconsistent state.
- **Add a manual item:** `createManyApiHouseholdsShoppingItemsCreateBulkPost`
  with `{ shoppingListId, display }` where `display` is a **non-empty trimmed**
  value; normalise `listItems ?? []` everywhere.
- **Delete an item:** `deleteOneApiHouseholdsShoppingItemsItemIdDelete`.
- **States:** (a) no current list → "build your first list"; (b) current list
  with all items checked / none left → a **"all done / cleared"** completed
  state (distinct from a).

### 4. Add-from-recipe + previous lists

- **Recipe page** "Add to shopping list" → adds to the **current** list (optional
  servings; create one if none), **always via the bulk endpoint with a single
  element** (`addRecipeIngredientsToListApiHouseholdsShoppingListsItemIdRecipePost`).
  The single-recipe endpoint is deprecated — don't use it.
  - Recipe pages are **public**, so when anonymous this action is **hidden** and
    replaced by a **Sign-in CTA that preserves the current recipe** (return-to),
    rather than a dead button.
- **Previous lists**: a minimal history view (own paginated summary query, tap to
  open). `ShoppingListSummary` has no items, so opening one does a detail fetch.
  The opened list is **URL-addressable** (e.g. `/shopping?list=<id>`) and
  **visually distinct from "current"** so users don't accidentally mutate an old
  list after browsing history.

### 5. Mealie API surface (all via the BFF, authed pass-through)

Mealie names the list-ID path param **`item_id`** throughout shopping endpoints.

| Need | SDK fn |
|------|--------|
| Current list (newest) | `getAllApiHouseholdsShoppingListsGet` (`orderBy=createdAt, orderDirection=desc, orderByNullPosition=last, perPage=1`) |
| History | same fn, separate paginated query |
| Create list | `createOneApiHouseholdsShoppingListsPost` |
| List detail + items | `getOneApiHouseholdsShoppingListsItemIdGet` |
| Add recipe(s), scaled (bulk; also single) | `addRecipeIngredientsToListApiHouseholdsShoppingListsItemIdRecipePost` — `Array<{recipeId, recipeIncrementQuantity}>` |
| Check off / update item | `updateOneApiHouseholdsShoppingItemsItemIdPut` (explicit field mapper; resp `ShoppingListItemsCollectionOut`) |
| Add manual item(s) | `createManyApiHouseholdsShoppingItemsCreateBulkPost` |
| Delete item | `deleteOneApiHouseholdsShoppingItemsItemIdDelete` |
| Cleanup empty list | `deleteOneApiHouseholdsShoppingListsItemIdDelete` |
| Plan for range | mealplans GET (builder's own `today … today+(N−1)` query) |

## Error handling — create-and-add state machine

The build is two non-transactional calls (create list, then bulk add). Specify a
state machine rather than ad-hoc retry + fire-and-forget delete:

1. **Disable Confirm while a build is pending** (prevents double-click creating
   multiple lists).
2. Create the list, then bulk-add recipes.
3. **On ambiguous bulk failure**, fetch the just-created list:
   - **Has items** → open it with a **partial-success warning** (keep it; it's a
     usable list).
   - **Empty** → **best-effort delete**, and **await cleanup completion** before
     allowing retry.
4. **Retry reruns the whole create-and-add** only *after* any cleanup has
   completed — so retry never targets a list mid-deletion, and we never leak
   multiple lists.
5. If a cleanup delete itself fails, tell the user a stray empty list may remain
   and can be removed in Mealie.

Other: empty day range → review empty state (no list created); item check-off
failure → revert optimistic toggle; **expired session mid-shop** → the BFF
returns 403, so **roll back the optimistic change and prompt re-auth**
(return-to), not a generic toast.

## Testing

- **Pure:** day-range with `end = today+(N−1)` incl. **month/year and DST
  boundary** cases; recipe normalisation (`recipeId ?? recipe?.id`; skip only
  when no id; name/multiplier fallbacks); duplicate-recipe aggregation; scale =
  chosen/base with `baseServings ≤ 0`/undefined → multiplier (no NaN).
- **Current-list selection:** newest by `createdAt`, `null` dates sorted last;
  current query uses `perPage: 1` and is separate from history pagination.
- **Contract tests (guard schema drift):** check-off field preservation
  (`{shoppingListId, checked}` vs full mapper); repeated `recipeId` + fractional
  scaling via the bulk endpoint.
- **List view:** algorithmic aisle grouping/order by `labelSettings.position`,
  unlabelled last; optimistic check-off reconciled via
  `updatedItems?.find(id)` with refetch fallback; **rapid toggles serialized**;
  manual add unwraps `createdItems` with refetch fallback; delete.
- **Builder state machine:** unchecked recipes excluded; confirm disabled while
  pending; ambiguous failure with items → open + warn; empty → delete then allow
  retry; no duplicate lists on double-click.
- **Auth UX:** `/shopping` redirects anonymous; recipe-page action hidden + sign-in
  CTA (return-to) when anonymous; expired-session 403 → rollback + re-auth.
- **History:** previous list opens via detail fetch, is URL-addressable, and is
  visually distinct from current.

## Suggested build order (for the plan)

1. `/shopping` route + gating + nav + current-list view (aisle grouping,
   serialized check-off with explicit mapper + find/refetch reconcile, manual
   add/delete, both empty/completed states).
2. The plan → new-list builder (own-range fetch with `N−1`; recipe normalisation
   + duplicate aggregation; review/servings; create-and-add state machine).
3. Add-from-recipe (bulk single element; anonymous sign-in CTA).
4. Previous-lists history view (URL-addressable, distinct from current).
