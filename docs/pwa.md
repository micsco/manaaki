# Manaaki on mobile

Manaaki automatically keeps opened recipes and their images offline. Reading the
meal plan also downloads up to 21 linked recipes. There is no save-for-offline
button. Recipe responses remain fresh for 30 days; planning data uses the network
first and falls back to the last successful response when unavailable.

The data cache is limited to 150 recipe groups and 100 MiB. Recipe images and
details are evicted together. The 20 most recently accessed recipes receive
priority; other recipes are ranked by repeat usage and recency, with popularity
decaying over time. Individual responses larger than 12 MiB are not saved.
Storage failures do not prevent network responses from being displayed. Browser
storage eviction can clear the entire origin; the app requests persistent storage
automatically, but cannot force the browser to grant it.

The production build prerenders a neutral TanStack shell and precaches its JS,
CSS, and icons. User-rendered HTML and authentication callbacks are never cached.
Data caches are account-scoped. Sign-out and identity changes discard private
offline data and cooking progress. The cached identity is only for offline UI;
the server still authorizes every write.

Cooking checks, servings, and timers survive closing the app. Timer deadlines
include elapsed time while away. Browser suspension can delay alarms until the
app is active again. Screen wake lock is reacquired when cooking mode returns to
the foreground.

Updates wait for an explicit Update action. Navigation never forces a reload.
The worker retains two previous app-shell versions to support already-open tabs.

Shopping check-offs are queued automatically in account-scoped storage, with a
visible pending-sync count. Reopening, reconnecting, or returning to the app
retries synchronization; an open app also retries every 30 seconds while changes
are pending. The most recent local checked state wins. Sync reads the latest
server item before updating it, preserving its other fields. Deleted items are
removed from the queue. Permission failures retain the queue and show a sign-in
message. Adding or deleting items requires a connection.

Installation help lives in About Manaaki. Supported browsers expose a native
Install button; Safari receives home-screen instructions. Installed apps hide
that guidance. The manifest includes a stable identity, task shortcuts, and a
mobile screenshot. Fonts ship with the app and are included in the offline shell.
Mobile layouts respect safe areas, use larger touch targets, keep dialogs
scrollable in short viewports, and honor reduced-motion preferences.

## Validation

Run `pnpm check:fix`, `pnpm type-check`, `pnpm test`, `pnpm build`, then
`pnpm test:pwa`. Install browser engines with
`pnpm exec playwright install chromium webkit` when needed.

The PWA suite runs the production build against a local fixture server, without
Mealie credentials. Chromium tests use browser offline mode. WebKit tests drop
the fixture server's connections because its Playwright offline-emulation mode
returns an internal navigation error with service workers. Both verify cached
reloads and persistent cooking checks. Physical installed iOS and Android testing
is still useful for OS-specific installation, keyboard, and suspension behaviour.

## Share a recipe into Manaaki

On Android, install Manaaki using Chrome, then share a recipe webpage, Instagram
post, or YouTube link and choose Manaaki. Existing installations may take time to
pick up the updated manifest. The share opens the import dialog with the URL
filled in; importing starts when you tap Import Recipe. Links embedded in shared
text or titles are supported. Sign-in preserves the incoming share.

The entry point is `/share?url=<encoded URL>`; `text` and `title` are also accepted.
It uses GET because receiving a share only opens a form. No recipe is created on
navigation or reload. The precached shell can open this page offline after an
online visit. The original shared link stays in the page URL across reloads;
importing requires connectivity. Edits to the input are not persisted on reload.

Safari on iOS does not support PWA share targets. A Shortcuts share-sheet action
can use the same entry point without an API token:

1. Create a shortcut named “Import into Manaaki” and enable Show in Share Sheet.
2. Accept URLs and Text; use Get URLs from Shortcut Input and Get First Item.
3. URL Encode that URL.
4. Add a URL action containing `https://manaaki.micsco.nz/share?url=` followed by
   the encoded URL variable (use your own Manaaki origin if different).
5. Add Open URLs.

This opens Manaaki’s web import flow; iOS may open Safari rather than the installed
home-screen app. Sharing a page URL is supported; sharing screenshots or video
files is not part of this handler.

Manaaki sends the link to the existing Mealie URL importer. Video/social recipe
extraction depends on the installed Mealie version and its configured AI/audio
providers, and private or inaccessible posts can fail. Receiving a link does not
add transcription capabilities to the server.

References: [Chrome share target guide](https://developer.chrome.com/docs/capabilities/web-apis/web-share-target),
[MDN share_target](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/share_target),
[Mealie AI providers](https://docs.mealie.io/documentation/getting-started/installation/ai-providers/).
The PWA tests simulate incoming share URLs in Chromium and WebKit, including
review-before-import and reload. OS share-sheet registration still needs a
physical installed-device check.

## Import quality

After a URL import, Manaaki asks Mealie’s OpenAI ingredient parser to structure
unparsed ingredients and prepares suggestions automatically. Suggestions are not
saved until reviewed. Existing foods, units,
recipe references, ingredient headings, and instruction reference IDs are
preserved. A parsing failure keeps the imported recipe and shows a warning;
retry from the inline button above Ingredients, or Recipe actions → Review title
and ingredients. The same dialog can
correct a title supplied incorrectly by a source website’s recipe metadata.
Mealie must have its AI provider configured. Manaaki does not silently substitute
a different parser when the AI provider fails.

Parsing reads fresh data and refuses to overwrite ingredients that changed while
parsing was in progress. Successful recipe edits invalidate cached detail aliases
and recipe lists so that old offline data does not hide the change.


The review follows Mealie’s validation rules: confidence below 0.85 (including
missing confidence) and suggested foods or units without IDs require attention.
Compare the original text, edit quantities and notes, choose existing foods or
units, or explicitly create missing records. New foods/units are added immediately
when their Create button is pressed, as in Mealie; canceling the review does not
remove those catalog records. Ingredient changes are applied only by Save reviewed
ingredients. Keeping an original ingredient declines its suggestion. Suggestions
are held in memory per signed-in user; reloading can require parsing again.

Reviewed against Mealie commit
[82387a2](https://github.com/mealie-recipes/mealie/blob/82387a281d6364b7e563bb9a93464eb662217193/frontend/app/composables/recipes/use-parse-ingredients-dialog.ts)
and its
[final ingredient review](https://github.com/mealie-recipes/mealie/blob/82387a281d6364b7e563bb9a93464eb662217193/frontend/app/components/Domain/Recipe/RecipePage/RecipePageParts/RecipeParseDialog/ParseDialogReview.vue).
