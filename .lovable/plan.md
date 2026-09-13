# Fix iPhone push activation and add diagnostics

## Confirmed findings
- **Published manifest header:** not fixed. The live `manifest.webmanifest` still returns `application/octet-stream`; the previous response rewrite does not run for statically served files.
- **Installed-mode detection:** both iOS signals are present (`navigator.standalone` and `display-mode: standalone`), but the automatic prompt can remain hidden by a persistent dismissal flag set before installation.
- **Published Apple metadata:** the source contains the required Apple tags; the deployed HTML will be checked again after publishing.

## Changes
1. Serve the manifest through an application route that guarantees `application/manifest+json`, while preserving the existing manifest contents and URL.
2. Make installed iOS detection explicit and reusable. In an installed app, do not let the earlier Safari installation-banner dismissal suppress the actionable notification prompt.
3. Add a bilingual **Push diagnostics** card under **Settings → My account**, visible only to the real `super_admin` account.
4. Show both standalone signals, permission, browser API support, service-worker registration/active state, user agent, local browser subscription, and whether the current user's subscription exists in the backend.
5. Add **Enable notifications (test)** as a direct user-gesture action. Display the permission result and any registration/subscription/save error on screen.
6. Add an authenticated read-only function for the current user's subscription status; keep the existing push dispatch pipeline unchanged.
7. Verify type/build status and the local diagnostics behavior, publish, then fetch the live manifest and HTML to confirm the corrected header and Apple tags.

## Technical details
- Keep `/sw.js` as the dedicated messaging worker; do not add offline/app-shell caching.
- Use existing authentication and row-level access so diagnostics can only inspect the signed-in user's subscriptions.
- The panel reports browser and subscription facts only; it does not expose push keys or subscription secrets.
