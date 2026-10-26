# Recipe versions

Some recipes have a separate version for another appliance, such as an air fryer
version of an oven bake. Mealie has no built-in way to group them, so each version
is its own recipe and the versions point at each other through Mealie's recipe
`extras`.

## Linking two versions

Add the other recipe's UUID (its `id` from the Mealie API, not its slug) to each
recipe's `extras`:

| Key | Points to |
|-----|-----------|
| `ovenVersion` | The oven version |
| `airFryerVersion` | The air fryer version |
| `slowCookerVersion` | The slow cooker version |

Each recipe's own method comes from its tools: the `Air Fryer` or `Slow Cooker`
tool, otherwise oven. So the air fryer version should have the `Air Fryer` tool and
an `ovenVersion` key, and the oven version an `airFryerVersion` key. If a recipe
links to the method its tools suggest (an air fryer copy missing its tool but
pointing at the oven version), it is treated as the first method it doesn't link to.

IDs are used rather than slugs because Mealie changes a recipe's slug when it is
renamed.

When at least one linked version exists in the recipe list, the recipe page shows
an Oven / Air fryer / Slow cooker switch above the times. A link to a missing
recipe, or to the recipe itself, is ignored.

## Creating a version with AI

Signed-in cooks can open the recipe actions menu (top right) and choose **Create
another version with AI…**, which opens a full page at
`/recipes/<id>/<slug>/new-version`. Pick the appliance, add any notes, and Gemini drafts a
new method on Manaaki's server. Nothing is saved until you review it:

- Automated checks run on the draft and again after every edit. **Must fix** items
  disable Save; other warnings need the "I've checked" tick.
- Ingredient changes are listed one by one with a reason, all ticked; untick any you
  don't want. Ingredients are otherwise copied exactly.
- The original and the draft sit side by side on wide screens, with a switch for
  Side by side, Original only or Draft only (Original / Draft on phones). Changed
  times show the original value, and the original ingredient list marks changed
  and removed lines.

While Gemini works, the page shows the stage it has reached (reading the recipe,
planning, writing the steps with a running count, running the checks) and the time
so far. The server streams these as newline-delimited JSON events from Gemini's
streaming API.

Each draft records how the model performed, without any recipe text:

- The server logs one `recipe_version_draft` JSON line per draft (Dokploy logs) with
  the outcome, model, input, output and thinking tokens, the time to load the recipe
  from Mealie, time to Gemini's first streamed chunk (`firstChunkMs`, usually a thought
  summary, so roughly connection plus reading the prompt), time to the first word of
  the draft (`firstTokenMs`), model time, checks time and total
  time, plus the number of blocking checks and warnings and the confidence. Failures
  log the status and the reason.
- PostHog gets `recipe_version_draft_requested`, `_received` (with the same timings
  and tokens plus the time the cook waited), `_failed` (with the error message) and
  `_cancelled`, then `recipe_version_saved` or `recipe_version_save_failed`.

Save duplicates the recipe in Mealie, applies the reviewed name, description, steps,
times and tool, keeps the original notes and adds any new ones, then links the two recipes both ways through `extras` and
adds a note to each.

The household's own appliances (a Ninja Foodi MAX Dual Zone air fryer, AF400UK, and
a Ninja Foodi PossibleCooker slow cooker, MC1001UK) are described in
`src/utils/householdAppliances.ts`: capacity, functions, settings and how to write
for each, taken from Ninja's product pages and instruction manuals (AF400UK, April
2021; MC1001UK, August 2022). Where they disagree, the safer figure is used: the
PossibleCooker pot is listed as oven-safe to 240°C (the manual says 260°C). Their details go into every prompt for that method, so the model doesn't
need to look anything up, and the setup screen names the appliance. Edit that file
when an appliance changes. There is no specific oven entry.

The server needs `GEMINI_API_KEY` in its runtime environment (never a `VITE_`
variable). `GEMINI_MODEL` (default `gemini-3.8-flash`) and
`RECIPE_VERSION_DRAFTS_PER_HOUR` (default 10) are optional. `GEMINI_THINKING_LEVEL`
(`minimal`, `low`, `medium` or `high`) sets how much Gemini thinks before writing;
unset, the model's default applies. The level is logged with each draft. Gemini
also streams short thought summaries, and the progress panel shows the latest one
under "Planning the new method". Before changing the
prompt or model, run `pnpm eval:recipe-versions` with a key in `.env`. The design
is in `docs/superpowers/specs/2026-10-26-ai-recipe-versions-design.md`.

## Notes

Recipe notes render a small, safe subset of markdown: paragraphs, line breaks,
bold, italic, inline code, bulleted and numbered lists, and links. HTML is shown as
text. Links to `https://manaaki.micsco.nz/...` or to a path starting with `/` open
inside Manaaki, keeping any query and `#` section; `/api/...` links go to the server
instead. Other `http(s)` links open in a new tab; anything else is shown as plain
text. A blank line starts a new paragraph, and a list can follow a line of text
directly. Link to recipes with their Manaaki address, which carries the recipe
ID, so the link keeps working after a rename.
