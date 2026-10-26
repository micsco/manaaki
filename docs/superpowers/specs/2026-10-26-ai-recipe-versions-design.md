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
   Response: `{ draft, checks }`.
3. **Review screen.** Side by side, original vs draft:
   - name, description, times (prep / cook / total / waiting note)
   - method steps (editable textareas)
   - ingredient changes, if any, shown as explicit rows ("olive oil 1 tbsp → 1 tsp,
     because air fryers need less") with keep/revert toggles
   - notes the model added (editable)
   - the check results, failures first

   Actions: **Save as new recipe**, **Regenerate** (optionally with more notes),
   **Cancel**. Save is disabled while any blocking check fails; warnings need an
   explicit "I've checked these" tick.
4. **Save.** The browser, with the user's own Mealie permissions through the existing
   proxy: `POST /api/recipes/{slug}/duplicate` (keeps ingredients, photo, nutrition,
   tags) → `PATCH` the copy with the reviewed name, description, steps, times,
   waiting note, tool and `extras.<method>Version` pointing back → `PATCH` the
   original's `extras` to point at the copy. Any failure after the duplicate rolls
   forward visibly ("Saved, but linking failed: Retry linking") rather than leaving a
   silent half-state. The user lands on the new recipe, where the version switch
   appears.

Nothing is written to Mealie before step 4. Abandoning the review costs only the
model call.

## Automated checks

Deterministic code, run on the server after parsing and again in the browser after
edits (shared module `src/utils/recipeVersionChecks.ts`). **Block** means Save is
disabled; **warn** means Save needs the acknowledgement tick.

| Check | Level |
|---|---|
| Output matches the schema (Zod parse); no empty name or steps | block |
| Every original ingredient is accounted for: unchanged, or listed in `ingredientChanges` with a reason. No silently dropped lines. | block |
| No new ingredients unless listed with a reason | block |
| Ingredient quantity changes limited to the listed rows; amounts stay within ×0.25–×2 of the original | warn |
| Times present; `total ≥ max(prep, cook)`; cook within the method's plausible range (air fryer 5–60 min per stage, slow cooker 2–10 h, oven 5–240 min) | block for missing or impossible, warn for out of range |
| Every temperature in the steps is °C and plausible for the method (air fryer 140–210°C, oven 120–250°C); slow-cooker steps name LOW/HIGH, not degrees | warn |
| The steps mention the target appliance at least once, and don't mention the source appliance's setup ("preheat the oven" in an air fryer version) | warn |
| Food-safety guidance kept: if the original states a core temperature or "cooked through" check for meat/fish, the draft keeps one | warn |
| Step count within 50–200% of the original | warn |
| Plain text only: no HTML, no links except Manaaki recipe links; markdown limited to what `RecipeNotes` renders | block (stripped and reported) |
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
- **Recorded-response fixtures:** a handful of real model outputs saved as JSON
  (one per method, plus a deliberately bad one) and run through the checks in CI. No
  live API calls in CI.
- **Opt-in eval** (`pnpm eval:recipe-versions`, not in CI, prints its cost first):
  - runs about 10 real recipes from the collection through the live model
  - scores each draft with the deterministic checks
  - adds a short rubric graded by a second model call: method correct for the
    appliance, temperatures sensible, nothing missing
  - writes a summary table, run before changing the prompt or model
- **Normal gates:**
  - `pnpm check:fix`, `type-check` and `test` on commit
  - `test` and `build` on push
  - `/code-review` before merge, as for every change this week

## Out of scope (for now)

- Scaling servings, dietary swaps (vegan, gluten-free), or other "variant" kinds.
  The same flow could take them later with different checks.
- Editing an existing version with AI.
- Automatically regenerating when the original recipe changes.

## Open decisions

1. Add `GEMINI_API_KEY` (the household's existing Google AI key works) to Manaaki's
   environment in Dokploy.
2. Whether the AI may adjust ingredient amounts (e.g. less oil for the air fryer).
   The default proposed here is yes, but only as explicit rows you approve.
