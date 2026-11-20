# GoPlan

GoPlan is a Japanese outing planner for saving places, organizing plans, and building day itineraries with PLANI.

## Development status

This branch, `goplan-completion`, is for development only. It has not been merged into `main` or released. The frontend and backend source code still require deployment configuration and real-account/device testing before a release.

## App features

- Home, wish list, plans, calendar, photos, and search.
- Four themes: NATURAL, TIGERS CLASSIC, TIGERS NIGHT, VINTAGE TIGERS.
- Light, dark, and system display modes; per-device theme override.
- Wallpaper sharing across devices by default, screen-specific wallpaper overrides, and a per-device opt-out.
- Local IndexedDB backups, protected restore/delete, and export to JSON.
- PLANI chat, approved-only memories, conversation history, saved AI plans, place search with Google Places photos, and day-plan generation.
- Google account sign-in, server-side cloud sync with revision checks and tombstones, and five previous cloud snapshots.
- Saved-place monitoring and push reminders, with a 6:00–22:00 local quiet window.
- PWA app-shell caching for offline opening after a successful online visit.

## Architecture

- `index.html`: app shell and local-first application features.
- `goplan-cloud.js`: Google sign-in, cloud sync, PLANI, Places, saved-place monitors, profile/privacy controls.
- `config.js`: public API URL and Google OAuth Web client ID only.
- `worker/`: Cloudflare Worker, D1 schema, scheduled jobs, API documentation.
- `privacy.html`: privacy information for the development build.
- `sw.js` / `manifest.webmanifest`: PWA metadata and offline shell.

The Worker is the secure backend. OpenAI and Google Places API keys, VAPID private key, and any other secret stay in Worker secrets, never in frontend source or Git history.

## External setup required

Live cloud features are inactive until the service owner configures and deploys the Worker:

1. Cloudflare Worker and D1 database.
2. Google OAuth Web client ID with the GitHub Pages origin authorized.
3. OpenAI API key for PLANI chat and itinerary research.
4. Google Maps / Places API key for place search, photos and saved-place monitoring.
5. VAPID keys for Web Push.
6. The Worker URL and public Google client ID in `config.js`.

Some providers may require an account, payment method, or usage billing. The repository/service owner or a parent/guardian should manage those settings. Never place private credentials in this repository or send them in chat.

See [worker/README.md](worker/README.md) for setup instructions.

## Important behavior and limitations

- Local backups remain in the browser/device. Cloud sync uses Cloudflare D1 and stores the latest state plus up to five previous snapshots.
- Google Drive appData backup is a separate optional feature in the app; it is not the same as Worker cloud sync. Google appData is hidden application storage and should not be treated as a shared folder.
- PLANI and cloud sync require an internet connection. Saved local data remains viewable offline.
- Notifications require browser permission and a supported installed/browser environment. A notification may be delayed by the operating system or push provider.
- Places information can be incomplete or change without notice. Users should check official venue information before travelling.
- AI-generated itineraries may contain errors. Check opening hours, access, fares and official sources before relying on a plan.
- The privacy document is a development draft. Replace operator contact details and verify the data-handling description before public release.

## Local checks

Run:

```sh
node --check worker/src/index.js
node --check goplan-cloud.js
node --check sw.js
node scripts/check-app.mjs
```

A passing static check does not replace live Google OAuth, real D1 sync, actual OpenAI/Places requests, PWA installation, offline use, or push-notification testing.

## Release rule

Do not merge this branch into `main` until the full checklist in `worker/README.md` and the live test report are complete.
