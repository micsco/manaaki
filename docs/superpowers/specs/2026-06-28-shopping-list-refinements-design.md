# Shopping-list refinements — design

Date: 2026-06-28

## Problem

The shipped shopping-list builder works, but real use surfaced four UX gaps:

1. **No feedback** when adding a recipe to the list — you can't tell whether it
   went to a new or existing list.
2. **"Add to shopping list" appends to a stale list.** It targets the
   most-recently-created list; if that's a *finished* shop (everything checked
   off), the new ingredients land among strikethroughs. Confusing.
3. **No way to see which recipe(s) introduced an ingredient.** Mealie showed
   this via a per-item expander; we want that plus a summary of the list's
   recipes at the top.
4. **No way back out of `/shopping`** — the page has no navigation to leave.

This is a cohesive batch of refinements to the existing feature, not new
subsystems — one spec/plan.

## Goals

- Clear feedback on every add (which recipe, which list, new vs existing).
- "Add to shopping list" targets the *active* shop and starts a fresh one when
  the current list is old — with an easy override.
- Surface the recipes behind a list (summary) and behind each item (expander),
  linked to their recipe pages.
- A back link out of `/shopping`.

## Non-goals (deferred)

- Per-recipe servings choice on the recipe-page add (stays ×1).
- Editing/merging recipe references; recipe-scale display per item.
- A full notification center — just transient toasts.

## Decisions (from brainstorming)

- **Toasts via Base UI's `Toast`** (`@base-ui/react`, already a dependency — no
  new packages; consistent with the app's existing Base UI usage).
- **Staleness rule:** add to the current list if it's **≤ 48h old**; otherwise
  start a new list. The append toast offers **"New list instead"**.
- **#3 scope:** both the top summary and the per-item expander, with recipe
  names **linking** to their recipe pages.
- One thing of note: the override **moves** the recipe (removes it from the old
  list) rather than duplicating it.

## Components

### 1. Toasts (Base UI `Toast`)

- Use `@base-ui/react` `Toast` (already installed). Mount `<Toast.Provider>` +
  a styled `<Toast.Viewport>` containing one `<Toast.Root>` template
  (Title / Description / optional action / Close) in the root provider tree
  (`src/routes/__root.tsx`, alongside the existing providers). Headless +
  SSR-safe; styled to match the dark theme.
- Provide a thin wrapper so call sites stay simple. Two options the plan will
  pick between: (a) a `useToast()` hook returning `Toast.useToastManager()`'s
  `add`; or (b) a module-level manager via `Toast.createToastManager()` passed to
  `<Toast.Provider toastManager={…}>` so `toast.add(...)` works outside hooks.
  Prefer (a) where the caller is already a component (our cases are).
- Per-toast action: the `<Toast.Root>` template renders a `<Toast.Action>` from
  the toast's `actionProps` (e.g. `{ children: "New list instead", onClick }`);
  `add({ title, description?, actionProps?, type? })`. (Confirm the exact `add`
  option name for the action against `@base-ui/react@1.4.1` during the plan.)
- Tests mock the wrapper (e.g. `vi.mock("../components/toast", () => ({ useToast: () => ({ add: vi.fn() }) }))`) so components can assert toast calls without the Base UI tree.

### 2. Smart "Add to shopping list" + feedback (#1 + #2)

`src/components/AddToShoppingListButton.tsx`:
- Pure helper `shouldStartNewList(createdAt: string | null | undefined, now: number): boolean`
  → `true` when `createdAt` is absent or `now - Date.parse(createdAt) > 48h`.
  (Lives in `src/utils/shopping.ts`.) The current list summary already carries
  `createdAt`, so no extra fetch.
- On click (authed):
  - **Start-new** (no current list, or stale): `buildShoppingList({ name, selections: [{ recipeId, recipeIncrementQuantity: 1 }] })`; toast
    `"Started a new shopping list with {recipe}"` with action **"View list"** →
    `/shopping`.
  - **Append** (current ≤48h): add the recipe to the current list (bulk endpoint,
    single element); toast `"Added {recipe} to your shopping list"` with action
    **"New list instead"** → the override.
  - **Override**: create a new list with the recipe; best-effort
    `removeRecipeIngredientsFromList(currentId, recipeId)`; navigate to
    `/shopping?list={newId}`; toast `"Moved {recipe} to a new list"`.
  - Invalidate `currentListQueryOptions`.
  - Failure → an error toast `"Couldn't add to your shopping list"`.
- Anonymous still shows the **Sign in to add** CTA (unchanged).
- New-list name: `Shop · {today}` (today's date), consistent with the builder's
  naming.

### 3. Which recipes (#3)

- `recipeId → { name, slug }` resolution from the cached recipe list. A small
  hook `useRecipeNameMap(): Map<string, { name: string; slug: string }>` built
  from `recipeListQueryOptions`/`useRecipeList`. Unknown ids are simply not
  linked (shown as "Recipe" or omitted).
- **Top summary** — new `ShoppingListRecipes` component: from
  `list.recipeReferences` (dedupe `recipeId`), render "Recipes in this list:"
  followed by recipe-name links (`recipeUrl(id, slug)` opening the recipe page).
  Renders nothing when there are no references.
- **Per-item expander** — `ShoppingListItemRow` gains a disclosure control shown
  only when `item.recipeReferences?.length`. Tapping toggles a sub-row listing
  the source recipe name(s) as links. Local component state; the control is
  separate from the toggle and delete controls (distinct `aria-label`s). Manual
  / reference-less items render no control.

### 4. Back link (#4)

`/shopping` header gains a back link to `/recipes`, matching the `/plan`
header's chevron-left "Recipes" link.

### 5. Build feedback (#1, build path)

On a successful Build, a success toast `"Created a shopping list from {n} recipes"`
(n = selected recipes) — emitted from `BuildShoppingListDialog` on success
before `onBuilt`.

## Mealie / data notes

- `removeRecipeIngredientsFromListApiHouseholdsShoppingListsItemIdRecipeRecipeIdDeletePost`
  backs the override (path `{ item_id: listId, recipe_id }`).
- `ShoppingListItemRecipeRefOut` / `ShoppingListRecipeRefOut` carry only
  `recipeId` (+ quantity/scale) — names come from the recipe-list map.

## Error handling

- Add/override failures → `toast.error`; the optimistic nature is minimal here
  (the recipe-page add isn't optimistic — it awaits then toasts).
- Override's remove-from-old is best-effort (swallow); if it fails the recipe may
  remain in both lists — acceptable, the new list is still correct.
- Unknown `recipeId` in references (deleted recipe / not in the loaded list) →
  unlinked label, never a crash.

## Testing

- **Pure:** `shouldStartNewList` (absent/null, exactly 48h, <48h, >48h); recipe
  name-map build (dedupe, unknown id).
- **AddToShoppingListButton:** age branch (recent → append; stale/none → new);
  correct toast + action wired; override calls remove + create + navigate;
  anonymous CTA; error → error toast. (Mock the toast wrapper + the hooks.)
- **ShoppingListItemRow:** expander present only with `recipeReferences`; reveals
  linked recipe(s); absent for manual items; toggle/delete still work.
- **Top summary:** renders linked recipes from references; nothing when empty.
- **Back link:** present in `/shopping` header → `/recipes`.

## Suggested build order (for the plan)

1. Base UI Toast wrapper (`useToast`/`<Toast.Provider>`+`<Toast.Viewport>`)
   mounted in root.
2. `shouldStartNewList` pure helper + recipe name-map hook.
3. Smart Add-to-list (age branch, toasts, override).
4. Recipe sources — top summary + per-item expander.
5. Back link + build-success toast.
