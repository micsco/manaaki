# Recipe share button + PWA review — design

Date: 2026-06-21

## Problem

Recipe pages need a way to share the page. When Manaaki is installed to the
home screen and runs in `display: standalone` mode, the browser chrome — and
with it the browser's built-in share button — is gone, so there is currently no
way for a user to share a recipe. Separately, the PWA setup should be reviewed
for whether it is sensible for what the app is (a thin alternative frontend over
the Mealie API).

## Part 1 — Recipe share button

### Approach

Use the Web Share API (`navigator.share`), which invokes the OS-native share
sheet — the same sheet the browser's own share control feeds into, and the one
piece missing in standalone mode. Where `navigator.share` is unavailable
(notably desktop browsers), do not render the button: those users still have
browser chrome with share/copy-URL, so they lose nothing. No fallback menu, no
per-app targets — the native sheet already offers the user's installed apps.

### Component

New client-only component `ShareRecipeButton` (`src/components/ShareRecipeButton.tsx`):

- Props: `recipe: RecipeOutput` (only `name` is needed for the share title).
- Renders `null` during SSR and the first client paint. A mount effect sets a
  `mounted` flag; the button renders only when `mounted && typeof navigator !==
  "undefined" && typeof navigator.share === "function"`. This avoids any
  hydration mismatch and naturally hides the button where unsupported.
- On click: `await navigator.share({ title: recipe.name ?? "Recipe", url:
  window.location.href })`. The recipe loader 301-redirects to the canonical
  URL, so `window.location.href` is always the correct share target — no URL
  reconstruction.
- Errors: swallow `AbortError` (user dismissed the sheet) silently; other
  errors are non-fatal and ignored (no toast needed).
- Analytics: on a successful share, PostHog `capture("recipe_shared", {
  recipe_id, recipe_name })`, consistent with existing hero events.
- Styling: matches the existing hero icon buttons —
  `rounded-full bg-black/40 p-1.5 text-white backdrop-blur-sm
  transition-colors hover:bg-black/60`. Icon: `mdiShareVariant` from `@mdi/js`.
  `aria-label="Share recipe"`.

### Placement

In `RecipeHeader.tsx`, the hero's **top-right cluster** (currently only rendered
when prev/next exist). Restructure so the top-right cluster always renders,
containing the share button followed by the prev/next nav arrows (the arrows stay
conditional inside it). The share button sits to the left of the nav arrows.

## Part 2 — PWA review

The manifest (`public/manifest.webmanifest`) is well-formed and satisfies
installability: `name`, `short_name`, `description`, `start_url`,
`display: standalone`, theme + background colours, and an icon set (192, 512,
512-maskable, SVG). Findings:

1. **No service worker / offline — keep it that way. No action.** Manaaki is a
   thin client over the Mealie API; offline caching is significant work for
   little benefit, update detection already exists (`useVersionCheck` /
   `BuildInfo`), and Chrome no longer requires a service worker for
   installability. Omitting it is the right call.

2. **Missing iOS / standalone meta tags — fix.** Add to `__root.tsx` head:
   `mobile-web-app-capable=yes`, `apple-mobile-web-app-status-bar-style`
   (`black-translucent` to suit the dark `#1f2937` theme), and
   `apple-mobile-web-app-title=Manaaki`. Improves standalone behaviour and
   status-bar appearance on iOS.

3. **Maskable icon will be clipped — fix if an asset can be generated locally.**
   The maskable icon reuses the full-bleed `manaaki-512.png`; the artwork runs to
   the bottom-left/right edges and will be cropped under Android's adaptive-icon
   safe-zone mask. Fix: a dedicated maskable PNG with the artwork scaled to ~70%
   on the same `#1f2937` background, referenced from the manifest's maskable
   entry. Generate locally with `sips` if possible; otherwise flag for manual
   export.

## Out of scope

- Service worker / offline support.
- Fallback share UI / per-app share targets.
- Any change to OG / Twitter meta (already present and correct).

## Testing

- `ShareRecipeButton`: unit tests (vitest + RTL) covering — not rendered when
  `navigator.share` is absent; rendered when present; click calls
  `navigator.share` with the recipe name and current URL; `AbortError` does not
  throw.
- `RecipeHeader`: extend existing tests to assert the share button renders.
