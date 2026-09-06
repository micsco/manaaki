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
