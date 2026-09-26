# Mealie API schema

`mealie-v3.28.0.openapi.json` is the public OpenAPI document retrieved from
https://mealie.scottfamily.nz/openapi.json on 2026-09-26. Its `info.version` is
`v3.28.0`. It contains API definitions, not household data or credentials.

`pnpm generate` uses this checked-in release snapshot. Do not generate against
the demo server: it tracks nightly and can differ from the installed release.
On upgrades, save the new instance schema, update `openapi-ts.config.ts`, regenerate,
review the generated diff, and run the contract tests, type checks and full suite.

The schema types `queryFilter` as an unrestricted string. It cannot express which
model properties are filterable. In 3.28.0, timeline household IDs are associations
and an explicit household filter returns HTTP 400. Retrieve authorised timeline
pages without that filter, then retain only records whose `householdId` matches
the current user before caching or ranking them.
