# Household recipe discovery

Signed-in visitors see up to six recipes in each qualifying row above the recipe catalogue. Search and filters hide the rows without discarding the current snapshot. Anonymous visitors never request history, and the server proxy denies anonymous access to `/api/recipes/timeline` and its descendants.

## Ranking

- Recently popular: at least two distinct cooking days within the last 90 calendar days, including today; ordered by that count.
- Forgotten favourites: at least three distinct cooking days historically, with the latest strictly before the date six months ago; ordered by historical count.
- This time last year: at least two distinct cooking days within 42 days either side of today's date last year; ordered by that count.

Ties use the latest cooking day, then recipe ID. Recipes appear in only one discovery row. Recent matches take priority, then seasonal matches, then forgotten favourites, although the display order is recent, forgotten, seasonal. Deleted or unavailable recipes are excluded. Rows without qualifying recipes are hidden.

## Cooking evidence

Mealie does not expose a dedicated cooked-event type. Automatic meal-plan events are `info` records with subjects such as `Mike made this for dinner` or `Mike made this as a side`. Its English manual “made this” action creates a `comment` record with the subject `Mike made this`.

The classifier recognises these subjects, scopes records to the current household, and excludes unrelated events, invalid timestamps and future dates. It counts a recipe once per calendar day across users and event types, preventing a manual record and an automatic plan record from doubling the score. It does not separately count past meal-plan entries or infer multiple cooks from `lastMade`.

This intentionally accepts Mealie's assumption that past planned meals were cooked. Translated/custom manual-event subjects are not recognised; new supported formats need fixtures before extending the classifier. Calendar boundaries use the browser's local timezone, consistent with the existing meal-plan screen; Mealie's API schema does not provide a household timezone. Near-midnight records can therefore fall on a different date when travelling.

Upstream references:

- https://github.com/mealie-recipes/mealie/blob/mealie-next/mealie/services/scheduler/tasks/create_timeline_events.py
- https://github.com/mealie-recipes/mealie/blob/mealie-next/frontend/app/components/Domain/Recipe/RecipeLastMade.vue

## Fetching and stability

History and the next 14 days of meal plans load concurrently, in pages of 500. All history pages are needed for lifetime counts; failure does not publish a partial ranking. The plan is only used to label upcoming recipes, not to increase popularity.

The in-memory query cache is scoped by user, household and local date, stays fresh for 15 minutes, and expires after 24 hours without observers. There are no per-recipe requests, polling, focus refreshes, or persistent cooking-history storage. Once both the recipe catalogue and discovery data are ready, the component captures a snapshot for the visit. Cache updates cannot reorder visible cards. A later visit can adopt refreshed results; changing accounts remounts the snapshot immediately.

Loading placeholders reserve space initially. A failed discovery request offers its own retry while the ordinary recipe catalogue remains available.

## Mealie 3.28.0 compatibility

Timeline history is group-authorised. Mealie 3.28.0 rejects a `household_id`
query filter with HTTP 400 because that field is an association. Requests omit
that filter; each page is immediately filtered by the returned `householdId`
before it enters the household-scoped cache. This also keeps other households'
records out of rankings. The checked-in release schema and real-client contract
test cover the request shape; the browser fixture rejects the unsupported filter.
