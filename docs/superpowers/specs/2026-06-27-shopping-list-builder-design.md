# Shopping-list builder — design

Date: 2026-06-27
Revised: 2026-06-27 (incorporating external review — API precision + edge cases)

## Problem

manaaki now has an authenticated tier (per-user Mealie identity via the BFF). The
first feature to ride on it is a **shopping-list builder**: a nicer-than-Mealie
way to turn a meal plan into a shopping list and use it in the store. The user's
core workflow is "create a plan, then add the next few days (often 4 or 5) to a
shopping list," plus building lists recipe-by-recipe, plus actually checking
items off while shopping. Mealie's own multi-list management is the pain point to
avoid.

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

## Core model

- **Current list = the most recently created shopping list** for the household.
  Mealie's default list sort is **by name**, so this MUST be requested
  explicitly: `GET /api/households/shopping/lists?orderBy=createdAt&orderDirection=desc&perPage=-1`.
  The first item is current. `ShoppingListSummary.createdAt` is `string | null`;
  treat `null` as oldest (sort to the end — pass `orderByNullPosition` or handle
  client-side). There is no real "archive" flag — "previous" just means "not the
  latest."
- **Scope caveat (explicit):** Mealie shopping lists are **household-wide**, and
  `ShoppingListOut` carries both `userId` and `householdId`. "Current = newest"
  is therefore household-wide: if two members create lists, the newest wins
  regardless of author. Acceptable for this small-family deployment; noted so
  it's not a surprise.
- **Building creates a new list**, which becomes current. **Per-recipe adds
  append to the current list** (creating one if none exists).
- **Authed-only**: the whole feature requires the authenticated tier (writes).
  Gated like `/plan`. The BFF already passes authed writes through to Mealie, and
  `/api/households/shopping/*` is **not** in the anonymous allowlist, so the
  proxy already 403s anonymous access (server-side enforcement). No allowlist
  change needed.

## Components

### 1. Route, gating, nav

- New route **`/shopping`** (`src/routes/shopping.tsx`), `beforeLoad` guard
  mirroring `/plan` exactly: `fetchCurrentUser()` →
  `throw redirect({ href: "/api/auth/oauth" })` when anonymous. (`fetchCurrentUser`
  hits `/api/auth/me`, a TanStack Start server route — not a proxied Mealie path
  — so the allowlist doesn't apply to it.)
- Add a **"Shopping"** entry to `UserMenu` (next to "Meal Plan"), authed-only.

### 2. The builder: plan → new list (headline flow)

Entry: a **"Build shopping list"** action on both `/plan` and `/shopping`.

1. **Pick days** — quick options **next 3 / 4 / 5 / 7 days** from today
   (inclusive).
2. **Fetch the exact range.** The builder fetches its **own** mealplan query for
   `today … today+N` rather than reusing the `/plan` page's loaded window
   (`multiWeekBounds(-1, 1)`), which can miss days when "next 7" spills into a
   not-yet-loaded week.
3. **Gather recipes.** Include **every plan entry in range that has a linked
   recipe** (`recipe`/`recipeId` non-null), regardless of `entryType`
   (breakfast/lunch/dinner/side/…). Free-text entries (no recipe) are skipped.
   Nothing is silently dropped — all gathered recipes appear on the review screen
   for confirmation. Empty state when nothing in range has a recipe.
4. **Review screen** — each recipe row:
   - a checkbox (checked by default; uncheck to exclude — e.g. an eat-out night),
   - a **servings stepper** defaulting to the recipe's base servings
     (`RecipeSummary.recipeServings`, which is `number | undefined`). If base
     servings is **undefined or ≤ 0**, fall back to a simple **×1 / ×2 …**
     multiplier (never divide by zero).
5. **Confirm** →
   - Create a new list via `POST /api/households/shopping/lists`, auto-named from
     the range: **`Shop · <start>–<end>`** (e.g. `Shop · Jun 28–Jul 2`).
   - One **bulk** `POST /api/households/shopping/lists/{item_id}/recipe` with an
     array of `{ recipeId, recipeIncrementQuantity }`, where
     `recipeIncrementQuantity = chosenServings / baseServings` (1 when unchanged;
     the chosen multiplier when base servings are unknown/≤0). Mealie scales and
     merges ingredients server-side.
   - Navigate to the new (now current) list.

Day-range→recipe gathering and scale computation are **pure functions** (testable
without the API), including the `baseServings ≤ 0` guard.

### 3. The shopping list view (in-store use)

`/shopping` shows the **current** list (detail fetch
`GET /api/households/shopping/lists/{item_id}`):

- Items **grouped by Mealie food label/category** (aisle order); Mealie labels
  items and auto-merges duplicates. Unlabelled items group under a default
  heading.
- **Big touch-target check-off** (reuse the cook-mode visual language). Checked
  items strike through and sink to the bottom of their group.
- **Check-off mechanics:** `PUT /api/households/shopping/items/{item_id}` with
  body `ShoppingListItemUpdate` — this is a **full-object update**, and
  `shoppingListId` is **required**. So copy the existing item, flip `checked`,
  and send the whole object. The response is a
  **`ShoppingListItemsCollectionOut`** (`{createdItems, updatedItems,
  deletedItems}`), so reconcile the optimistic toggle from **`updatedItems[0]`**,
  not a bare item.
- **Mutation serialization:** check-off mutations are **serialized/queued per
  item** (e.g. a per-item lock or React Query mutation chaining) so rapid
  successive toggles on the same item can't race the full-object PUT into an
  inconsistent state.
- **Add a manual item** via `POST /api/households/shopping/items/create-bulk`
  (response is also `ShoppingListItemsCollectionOut` — read new items from
  **`createdItems`**).
- **Delete an item** via `DELETE /api/households/shopping/items/{item_id}`.
- **States:** distinguish (a) no current list at all → "build your first list"
  empty state, from (b) a current list whose items are all checked/none left →
  a **"all done / cleared"** completed state (not the same empty state).

### 4. Add-from-recipe + previous lists

- **Recipe page**: an "Add to shopping list" control that adds the current recipe
  to the **current** list (optional servings choice; create a list if none).
  **Always use the bulk endpoint with a single element**
  (`POST …/lists/{item_id}/recipe` with a one-item array). The single-recipe
  endpoint (`…/recipe/{recipe_id}`) is deprecated in Mealie — do not use it; this
  also keeps one add-recipe code path.
- **Previous lists**: a minimal history view — older lists by date (from the
  summary list), tap to open. `ShoppingListSummary` does **not** include items,
  so opening one triggers a detail fetch
  (`GET /api/households/shopping/lists/{item_id}`). Low-chrome; an escape hatch,
  not a management surface.

### 5. Mealie API surface (all via the BFF, authed pass-through)

Note: Mealie names the list-ID path param **`item_id`** throughout the shopping
endpoints (a Mealie quirk); `{item_id}` is the shopping list's id.

| Need | SDK fn / endpoint |
|------|-------------------|
| List all → current = newest | `getAllApiHouseholdsShoppingListsGet` — `?orderBy=createdAt&orderDirection=desc&perPage=-1` |
| Create list | `createOneApiHouseholdsShoppingListsPost` |
| List detail + items | `getOneApiHouseholdsShoppingListsItemIdGet` |
| Add recipe(s), scaled (bulk, also for single) | `addRecipeIngredientsToListApiHouseholdsShoppingListsItemIdRecipePost` — `Array<{recipeId, recipeIncrementQuantity}>` |
| Check off / update item (full PUT) | `updateOneApiHouseholdsShoppingItemsItemIdPut` — body needs `shoppingListId`; resp `ShoppingListItemsCollectionOut` |
| Add manual item(s) | `createManyApiHouseholdsShoppingItemsCreateBulkPost` — new items in `createdItems` |
| Delete item | `deleteOneApiHouseholdsShoppingItemsItemIdDelete` |
| Cleanup empty list (half-fail) | `deleteOneApiHouseholdsShoppingListsItemIdDelete` |
| Plan for day range | mealplans GET (builder's own `today…today+N` query) |

## Error handling

- **Create-then-bulk-add is two calls.** If the bulk add fails after the list is
  created, surface the error with a retry, and **best-effort delete the
  just-created empty list** (fire-and-forget, swallow errors). If that cleanup
  delete also fails, the error message tells the user a stray empty list may
  remain and they can remove it in Mealie.
- Empty day range (nothing planned / all free-text) → review empty state; no list
  created.
- Item check-off failure → revert the optimistic toggle and show an error.
- Standard network/error toasts consistent with existing pages.

## Testing

- Pure: day-range → recipe list from plan entries (skips free-text; includes all
  recipe-linked entry types); scale = chosen/base with **`baseServings ≤ 0` /
  undefined → multiplier fallback** (no NaN/divide-by-zero); bulk payload shape.
- "Current list" selection = newest by `createdAt`, with `createdAt: null` sorted
  oldest.
- List view: grouping by label; optimistic check-off **reconciled from
  `updatedItems[0]`** and reverted on failure; **rapid successive toggles on the
  same item are serialized** (no inconsistent final state); manual add unwraps
  `createdItems`; delete.
- Builder flow: review excludes unchecked recipes; confirm issues create + one
  bulk call; half-fail deletes the empty list (best-effort).
- States: no-list empty state vs all-checked completed state.
- Gating: `/shopping` redirects anonymous users; `UserMenu` shows Shopping only
  when authed.
- Builder fetches its own date range when "next N days" exceeds the `/plan`
  window.

## Suggested build order (for the plan)

1. `/shopping` route + gating + nav + current-list view with check-off
   (foundation you can use immediately; includes the serialize/reconcile logic).
2. The plan → new-list builder (own-range fetch → day picker → review/servings →
   create + bulk add + half-fail cleanup).
3. Add-from-recipe (bulk endpoint, single element).
4. Previous-lists history view (summary list → detail fetch on open).
