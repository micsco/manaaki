# AI-generated recipe versions — design

Date: 2026-10-26

## Problem

Some recipes are worth having in more than one appliance version (oven, air fryer,
slow cooker). Making one by hand means duplicating the recipe in Mealie, rewriting
the method and times, adding the right tool and linking the two versions through
`extras` (see `docs/recipe-versions.md`). The first one, BBQ Chicken Twice-Baked
Potatoes (Air Fryer), took a dozen API calls.

We want a recipe action, **Create another version with AI…**, that drafts the new
version, lets a person check and edit it, and only then saves and links it. An
appliance conversion changes temperatures, times and steps people will cook from,
so a confident but wrong draft is the main risk. Review is the core of the feature,
not an add-on.

## Where the AI runs

| Option | How | Verdict |
|---|---|---|
| A. Gemini from Manaaki's server | New server route calls the Gemini API with the recipe and a conversion brief, using JSON-schema structured output. Returns a draft only. | **Chosen.** Full control of the prompt, schema and checks; nothing is written to Mealie until approval. Same provider and model family the household already uses in Mealie. Needs a `GEMINI_API_KEY` runtime secret. |
| B. Mealie's AI import (`/api/recipes/create/ai`) | Send the recipe text plus "convert to air fryer" as user content. | Rejected. Mealie's prompts tell the model to transcribe, never invent, so conversions fight the prompt. It saves the recipe immediately (review after the fact, rejects become deletes), and we can't add our own checks before the save. |
| C. Claude from Manaaki's server | As A, with the Anthropic SDK. | Not chosen: the household already has Gemini set up. The server module keeps the model call behind one function, so switching later only touches that file. |

Model: `gemini-3.8-flash`, the model Mealie's "Google Gemini 3.8 Flash" provider uses
here, called through Google's official Gen AI SDK (`@google/genai`) with
`responseMimeType: "application/json"` and a `responseSchema` matching the draft
schema. The response is still parsed and validated with Zod on the server; schema
mode reduces malformed output but isn't treated as a guarantee. Use the model id
from an environment variable (`GEMINI_MODEL`, default `gemini-3.8-flash`) so a newer
Flash can be tried without a code change. Check the exact SDK calls against Google's
current docs at implementation time. Expected cost is a fraction of a penny per draft.

## Flow

1. **Start.** Recipe actions menu (signed-in users only, like the existing items) →
   *Create another version with AI…*. A dialog asks for the target method (Air fryer
   / Oven / Slow cooker; the current method and any already-linked method are
   disabled) and optional notes ("5.5 L basket", "we like it crispy").
2. **Draft.** The browser calls `POST /api/manaaki/recipe-versions/draft` with the
   recipe id, target method and notes. The server loads the recipe itself from
   Mealie with the user's session (never trusting recipe content from the browser),
   calls Gemini, validates the result and runs the automated checks (below).
   Response: `{ draft, checks, source }`.
3. **Review page.** A full page (`/recipes/<id>/<slug>/new-version`), not a dialog. On
   wide screens the original sits beside the editable draft, with a Side by side /
   Original / Draft switch; phones switch between Original and Draft. The draft has:
   - name, description, times (prep / cook / total / waiting note)
   - method steps (editable textareas)
   - ingredient changes, if any, shown as explicit rows ("olive oil 1 tbsp → 1 tsp,
     because air fryers need less") with keep/revert toggles
   - notes the model added (editable)
   - the check results, failures first

   A bar pinned to the bottom holds the warnings tick and **Save new version**,
   **Start again** (back to the method and notes) and **Cancel**. Save is disabled while any blocking check fails; warnings need an
   explicit "I've checked these" tick.
4. **Save.** The browser, with the user's own Mealie permissions through the existing
   proxy: `POST /api/recipes/{slug}/duplicate` (keeps ingredients, photo, nutrition,
   tags) → `PATCH` the copy with the reviewed name, description, steps, times,
   waiting note, tool and `extras.<method>Version` pointing back → `PATCH` the
   original's `extras` to point at the copy. Any failure after the duplicate rolls
   forward visibly rather than leaving a silent half-state: if updating the copy
   fails, the next Save updates that same copy instead of duplicating again; if only
   linking fails, the dialog offers **Retry linking**. The user lands on the new recipe, where the version switch
   appears.

Nothing is written to Mealie before step 4. Abandoning the review costs only the
model call.

## Automated checks

Deterministic code, run on the server after parsing and again in the browser after
edits (shared module `src/utils/recipeVersionDraft.ts`). In the browser only the
ticked ingredient changes are checked, so unticking a bad change clears its block. **Block** means Save is
disabled; **warn** means Save needs the acknowledgement tick.

| Check | Level |
|---|---|
| Output matches the schema (Zod parse); no empty name or steps | block |
| Ingredients are copied by Mealie's duplicate, never rewritten by the model. Each change names an existing line, once, with a reason; amounts must be valid numbers, and only lines with a parsed amount can change amount (unparsed lines can only be removed) | block |
| No new ingredients unless listed with a reason; they are added as note-only lines | block |
| Changed amounts stay within ×0.25–×2 of the original | warn |
| Times present; `total ≥ max(prep, cook)`; total cook within the method's plausible range (air fryer 5–90 min, oven 5–300 min, slow cooker 90–720 min) | block for missing or impossible, warn for out of range |
| Temperatures are °C and plausible for the method (air fryer 120–240°C, oven 100–260°C); slow-cooker steps name LOW or HIGH | warn |
| The steps mention the target appliance at least once, and don't mention the source appliance's setup ("preheat the oven" in an air fryer version) | warn |
| Food-safety guidance kept: if the original states a core temperature or "cooked through" check for meat/fish, the draft keeps one | warn |
| Step count within 50–200% of the original | warn |
| No HTML and no `javascript:` or `data:` links (notes render through the safe markdown subset) | block |
| Name ends with the method label, e.g. "(Air Fryer)", and doesn't collide with an existing recipe name | warn |

The model also returns `confidence` and `assumptions[]` (e.g. "assumes a 5.5 L basket
fits 4 potatoes"), shown above the steps. Low confidence is a warning.

## Prompt-injection and safety

- Recipe text comes from imported websites, so treat it as data. It goes in a
  delimited user block; the system prompt says the content may contain
  instructions to ignore. The model has no tools, so the worst outcome is a bad
  draft, which review and the checks catch.
- The server route requires a signed-in session (anonymous users are already denied
  write-adjacent routes), is rate-limited per user (e.g. 10 drafts/hour), and caps
  the input size.
- `GEMINI_API_KEY` is a runtime environment variable in Dokploy, read only on the
  server (`src/server/env.ts`), never `VITE_`-prefixed, never sent to the browser.
  This follows the existing Mealie token rule in `AGENTS.md`.
- Log the draft request (recipe id, method, token usage, check results) without
  recipe text, for cost tracking in PostHog.

## Review process for the code (development-time)

- **Unit tests** (Vitest, required by `AGENTS.md`):
  - every check, with passing and failing fixtures
  - schema parsing, including malformed and truncated model output
  - the save sequence with the SDK mocked, including partial-failure paths
  - review-screen interactions: edit, revert an ingredient change, acknowledge
    warnings, Save disabled on a blocking failure
- **Server route tests:**
  - unauthenticated → 401
  - rate limit → 429
  - oversized input → 413
  - a blocked or truncated Gemini response (safety block, `MAX_TOKENS` finish) → clean error
  - the API key never appears in responses or logs
- **Fixtures:** synthetic drafts in `src/test/fixtures/recipeVersionDrafts.ts` (a
  sound air fryer draft plus variations that break each check) run through the
  checks in CI. Replace them with recorded model outputs once there are some. No
  live API calls in CI.
- **Opt-in eval** (`pnpm eval:recipe-versions`, not in CI, needs `GEMINI_API_KEY`
  in `.env`):
  - runs three sample recipes (oven → air fryer, oven → slow cooker, air fryer →
    oven) through the live model
  - prints the token counts, each draft's method and its check results, and fails
    on any blocking check
  - run it before changing the prompt or model. A second-model rubric and real
    recipes from the collection are later additions.
- **Normal gates:**
  - `pnpm check:fix`, `type-check` and `test` on commit
  - `test` and `build` on push
  - `/code-review` before merge, as for every change this week

## Out of scope (for now)

- Scaling servings, dietary swaps (vegan, gluten-free), or other "variant" kinds.
  The same flow could take them later with different checks.
- Editing an existing version with AI.
- Automatically regenerating when the original recipe changes.

## Decisions

1. `GEMINI_API_KEY` is set in Manaaki's Dokploy environment. `GEMINI_MODEL`
   (default `gemini-3.8-flash`) and `RECIPE_VERSION_DRAFTS_PER_HOUR` (default 10)
   are optional.
2. The AI may adjust ingredient amounts (e.g. less oil for the air fryer), but only
   as explicit rows you approve; all are ticked by default.
3. nginx gives the draft route a 95-second read timeout; the server stops waiting
   for Gemini after 85 seconds.
