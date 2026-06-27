# Shopping-list builder — design

Date: 2026-06-27

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

- **Current list = the most recently created shopping list** for the household
  (sort all lists by `createdAt` desc; first is current). manaaki shows it as
  "the" shopping list. There is no real "archive" flag — "previous" simply means
  "not the latest."
- **Building creates a new list**, which becomes current. **Per-recipe adds
  append to the current list** (creating one if none exists).
- **Authed-only**: the whole feature requires the authenticated tier (writes).
  Gated like `/plan`. The BFF already passes authed writes through to Mealie
  (Mealie authorises), so no allowlist change is needed.

## Components

### 1. Route, gating, nav

- New route **`/shopping`** (`src/routes/shopping.tsx`), `beforeLoad` guard:
  `fetchCurrentUser()` → `throw redirect({ href: "/api/auth/oauth" })` when
  anonymous (mirrors `/plan`).
- Add a **"Shopping"** entry to `UserMenu` (next to "Meal Plan"), shown only when
  authenticated.

### 2. The builder: plan → new list (headline flow)

Entry: a **"Build shopping list"** action on both `/plan` and `/shopping`.

1. **Pick days** — quick options **next 3 / 4 / 5 / 7 days** from today.
2. **Review screen** — recipes gathered from those days' plan entries. Each row:
   - a checkbox (checked by default; uncheck to exclude — e.g. an eat-out night),
   - a **servings stepper** defaulting to the recipe's base servings
     (`recipeServings`/yield); if a recipe has no base servings, fall back to a
     simple **×1 / ×2 …** multiplier.
   - Free-text plan entries (no linked recipe) are skipped. Empty state when
     nothing in range has a recipe.
3. **Confirm** →
   - Create a new list via `POST /api/households/shopping/lists`, auto-named from
     the range: **`Shop · <start>–<end>`** (e.g. `Shop · Jun 28–Jul 2`).
   - One **bulk** `POST /api/households/shopping/lists/{id}/recipe` with an array
     of `{ recipeId, recipeIncrementQuantity }`, where
     `recipeIncrementQuantity = chosenServings / baseServings` (1 when unchanged;
     the chosen multiplier when base servings are unknown). Mealie scales and
     merges ingredients server-side.
   - Navigate to the new (now current) list.

Day-range→recipe gathering and the scale computation are **pure functions**
(testable without the API).

### 3. The shopping list view (in-store use)

`/shopping` shows the **current** list:

- Items **grouped by Mealie food label/category** (aisle order); Mealie already
  labels items and auto-merges duplicates across recipes. Unlabelled items group
  under a default heading.
- **Big touch-target check-off** (reuse the cook-mode visual language). Checked
  items strike through and sink to the bottom of their group. **Optimistic**
  toggle via the item update endpoint, reconciled on response.
- **Add a manual item** (free text) via `…/shopping/items/create-bulk`.
- **Delete an item**.

### 4. Add-from-recipe + previous lists

- **Recipe page**: an "Add to shopping list" control that adds the current recipe
  to the **current** list (optional servings choice; create a list if none),
  using the single-recipe add (`…/lists/{id}/recipe/{recipe_id}`) or the bulk
  endpoint with one element.
- **Previous lists**: a minimal history view — older lists by date, tap to open.
  Low-chrome; it's an escape hatch, not a management surface.

### 5. Mealie API surface (all via the BFF, authed pass-through)

| Need | Endpoint |
|------|----------|
| List all (→ current = latest) | `GET /api/households/shopping/lists` |
| Create list | `POST /api/households/shopping/lists` |
| List detail + items | `GET /api/households/shopping/lists/{id}` |
| Add recipes (bulk, scaled) | `POST /api/households/shopping/lists/{id}/recipe` (`Array<{recipeId, recipeIncrementQuantity}>`) |
| Check off / update item | item update at `/api/households/shopping/items/{id}` |
| Add manual item(s) | `POST /api/households/shopping/items/create-bulk` |
| Delete item | delete at `/api/households/shopping/items/{id}` |
| Plan for day range | existing `useMealPlan` / mealplans GET |

Exact generated SDK function names are pinned during planning; the URL paths
above are authoritative.

## Error handling

- **Create-then-bulk-add is two calls.** If the bulk add fails after the list is
  created, surface the error with a retry, and **delete the just-created empty
  list** so it doesn't become a stray "current."
- Empty day range (nothing planned / all free-text) → review screen empty state;
  no list created.
- Item check-off failure → revert the optimistic toggle and show an error.
- Standard network/error toasts consistent with existing pages.

## Testing

- Pure: day-range → recipe list from plan entries (skips free-text); scale =
  chosen/base (and multiplier fallback when base unknown); bulk payload shape.
- List view: grouping by label, optimistic check-off + revert on failure, manual
  add, delete.
- Builder flow: review excludes unchecked recipes; confirm issues create + one
  bulk call; half-fail cleanup deletes the empty list.
- Gating: `/shopping` redirects anonymous users; `UserMenu` shows Shopping only
  when authed.
- "Current list" selection = latest by `createdAt`.

## Suggested build order (for the plan)

1. `/shopping` route + gating + nav + current-list view with check-off (the
   foundation you can use immediately).
2. The plan → new-list builder (day picker → review/servings → create + bulk add).
3. Add-from-recipe.
4. Previous-lists history view.
