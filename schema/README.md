# Mealie API schema

`mealie-v3.29.0.openapi.json` is the public OpenAPI document retrieved from
https://mealie.scottfamily.nz/openapi.json on 2026-10-25. Its `info.version` is
`v3.29.0`. It contains API definitions, not household data or credentials.

`pnpm generate` uses this checked-in release snapshot. Do not generate against
the demo server: it tracks nightly and can differ from the installed release.
On upgrades, save the new instance schema, update `openapi-ts.config.ts`, regenerate,
review the generated diff, and run the contract tests, type checks and full suite.

The schema types `queryFilter` as an unrestricted string. It cannot express which
model properties are filterable. In 3.28.0 and 3.29.0, timeline household IDs are associations
and an explicit household filter returns HTTP 400. Retrieve authorised timeline
pages without that filter, then retain only records whose `householdId` matches
the current user before caching or ranking them.

3.29.0 stores recipe times as whole seconds in `prepTimeSeconds`,
`performTimeSeconds` and `totalTimeSeconds`. Its upgrade migration moved every
parseable time into those fields and cleared the matching text field, so the
text fields only hold times that are not a clear duration, such as "overnight".
Read times through `recipeTimes` in `src/utils/recipe.ts`, which prefers the
seconds fields and falls back to the text.
