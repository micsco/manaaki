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
`/recipes/<id>/<slug>/new-version`. Pick the appliance, add any notes, and the AI drafts a
new method on Manaaki's server. Nothing is saved until you review it:

- Automated checks run on the draft and again after every edit. They share one panel
  with the AI's assumptions. **Must fix** items disable Save; other warnings need the
  "I've checked" tick.
- The draft reads like a recipe: name, times, ingredients, numbered steps and new
  notes, each with Edit. Each step shows labels from the model's tags (zone,
  function, setting, time, and "At the same time" for a step that runs alongside
  the previous one), and a cooking plan lists the timed steps. A step's labels
  disappear once an edit changes its time.
- Ingredient changes are listed one by one with a reason, all ticked; untick any you
  don't want. Ingredients are otherwise copied exactly.
- The original and the draft sit side by side on wide screens, with a switch for
  Side by side, Original only or Draft only (Original / Draft on phones). Changed
  times show the original value, and the draft's ingredient list marks changed,
  removed and added lines.

While the AI works, the page shows the stage it has reached (reading the recipe,
planning, writing the steps with a running count, running the checks) and the time
so far. The server streams these as newline-delimited JSON events from the model's
streaming API.

Each draft records how the model performed, without any recipe text:

- The server logs one `recipe_version_draft` JSON line per draft (Dokploy logs) with
  the outcome, model, input, output and thinking tokens, the time to load the recipe
  from Mealie, time to the model's first streamed chunk (`firstChunkMs`, usually a thought
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

Server settings (runtime environment only, never `VITE_` variables):

| Variable | Purpose |
|---|---|
| `RECIPE_VERSION_MODEL` | Model that drafts versions. A `claude-…` model (for example `claude-sonnet-5-5`) uses Claude; anything else uses Gemini. Default: `GEMINI_MODEL`. |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Gemini key and model (default `gemini-3.8-flash`). |
| `GEMINI_THINKING_LEVEL` | `minimal`, `low`, `medium` or `high` (default `low`). |
| `CLAUDE_API_KEY` | Claude key (`ANTHROPIC_API_KEY` also works). |
| `CLAUDE_EFFORT` | `low`, `medium`, `high`, `xhigh` or `max`; unset uses the model's default. |
| `RECIPE_ESCALATION_MODEL` | Model for a second repair attempt when the first doesn't fix every problem (default `claude-sonnet-5-5`, used only when its key is set; `none` turns it off). |
| `RECIPE_VERSION_DRAFTS_PER_HOUR` | Drafts per person per hour (default 10). |

### How a draft is made

Models are called through `@tanstack/ai` (with its Gemini and Anthropic adapters)
behind a small `DraftingModel` interface in `src/server/recipeVersionModels.ts`, so
the provider can change without touching the pipeline.

1. **Draft.** One call writes the version with tagged steps: each step's text plus
   its zone, function, setting, minutes and whether it runs alongside the previous
   step.
2. **Check.** Code works out cook and total time from the tags, checks every tagged
   setting against the appliance's limits (`functions` in
   `src/utils/householdAppliances.ts`), checks that each step's text agrees with its
   tags, and runs the usual automated checks. Each finding names its step.
3. **Repair.** If anything must be fixed, the same model gets only the failing steps,
   their neighbours and the relevant limits, and returns replacement steps. The rest
   of the draft stays word for word, and a repair that doesn't reduce the problems is
   discarded.
4. **Escalate.** If problems remain, the escalation model gets one more patch
   attempt. Whatever is left shows up on the review page as usual.

The progress panel shows the model's thought summaries while it plans, the step
count while it writes, and "Fixing N problems" when a repair runs.
Each draft logs the model, setting, prompt version, model calls, repairs and escalations, and is traced in PostHog with an `$ai_generation` event for every model call (see `docs/observability.md`). The design is in
`docs/superpowers/specs/2026-10-26-ai-recipe-versions-design.md`.

## Evaluating drafts

`pnpm eval:recipe-versions` compares draft quality, speed and cost before you change
the prompt, model or thinking level. It runs on your machine, uses your own
`GEMINI_API_KEY` and `CLAUDE_API_KEY` from `.env` (in this checkout or the main one;
`.env` is gitignored), and saves nothing to Mealie.

1. It loads the recipes in `evals/recipe-versions/cases.ts` from the live site's
   read-only API. They cover oven → air fryer, oven → slow cooker, air fryer and slow
   cooker → oven, plus hard cases such as fish, baking and macaroni cheese.
2. It drafts each one with every drafter (a model and its thinking level or effort), using the production drafting code.
3. It runs the automated checks, then asks a judge (Claude Opus 5.5 at high effort
   when there's a Claude key, so Gemini doesn't mark its own work) to score
   each draft from 1 to 5 on appliance use, temperatures, timings, food safety,
   completeness and clarity, with up to five issues. Each issue has a category
   (liquid, capacity, settings, temperature, timing, doneness, lostDetail,
   ingredients, clarity or other), so the report can count what goes wrong most.
   Some cases have a reference: how the author or the household cooks the dish on
   the target appliance. The fattoush case removes the author's own oven
   alternative from the steps and gives it to the judge; the twice-baked potatoes
   case uses the household's linked air fryer version. The judge uses a reference
   to check temperatures, times and approach without marking down other methods
   that would also work.
4. It writes `evals/results/<time>/report.html` (summary by drafter with time,
   tokens, cost at current and 2027 prices, checks and scores, then each recipe side
   by side with scores, checks, issues and the steps) and `results.json`. Prices are
   in `evals/recipe-versions/prices.ts`. The summary also counts, for each
   drafter, the recipes it scored better, worse or the same on than the first
   drafter, and the issues per draft in each category. Overall differences under
   about 0.15 are noise; per-recipe counts and the categories show more.

Options, as environment variables: `EVAL_DRAFTERS` (comma-separated, default
Gemini low, medium and high, plus Claude Haiku, Sonnet and Opus when `CLAUDE_API_KEY`
is set; each is `gemini[:level]` or `claude-<model>[:effort]`, or a full pipeline such as
`structured/gemini:low>claude-sonnet-5-5`),
`EVAL_CASES` (comma-separated slugs), `EVAL_REPEATS` (default 1), `EVAL_JUDGE=0` to
skip the judge, `EVAL_JUDGE_MODEL` (default `claude-opus-5-5` when there's a Claude key,
otherwise `GEMINI_MODEL`),
`EVAL_CONCURRENCY` (default 3) and `EVAL_RECIPE_SOURCE` (default the live site). Each
draft costs one judge call too, so 20 recipes × 6 drafters is 120 drafts plus 120
judge calls.

### Prompt rule results (October 2026)

20 recipes × 2 repeats per arm, structured Gemini low with Sonnet escalation, judged
by Opus:

| Rules added to v2 | Overall | Completeness | Lost-detail issues per draft | Cost per draft |
|---|---|---|---|---|
| none | 3.92 | 3.95 | 1.07 | $0.0053 |
| `liquid` | 3.88 | 3.98 | 0.88 | $0.0056 |
| `load` | 3.98 | 4.03 | 0.97 | $0.0057 |
| `carry` | 4.00 | 4.38 | 0.60 | $0.0059 |
| all three | 4.03 | 4.38 | 0.45 | $0.0065 |

Only `carry` changed anything beyond noise: completeness rose on 12 recipes and fell
on 3. Its hands-on-time rules didn't improve the timing scores, and `liquid` and
`load` didn't reduce liquid or capacity issues. The `carry` rules are now part of the
prompt, logged as prompt version `v3`; the other rules and the earlier prompts were
removed and stay in git history. No public dataset pairs
the same recipe for oven, air fryer and slow cooker, so references come from the
household's own recipes.

## Notes

Recipe notes render a small, safe subset of markdown: paragraphs, line breaks,
bold, italic, inline code, bulleted and numbered lists, and links. HTML is shown as
text. Links to `https://manaaki.micsco.nz/...` or to a path starting with `/` open
inside Manaaki, keeping any query and `#` section; `/api/...` links go to the server
instead. Other `http(s)` links open in a new tab; anything else is shown as plain
text. A blank line starts a new paragraph, and a list can follow a line of text
directly. Link to recipes with their Manaaki address, which carries the recipe
ID, so the link keeps working after a rename.
