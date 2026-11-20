# GoPlan

GoPlan is a static web app for saving places you want to visit and organizing outings.

## Files
- `index.html` — application UI and client-side logic
- `manifest.webmanifest` / `sw.js` — install metadata and offline app-shell cache
- `icon-*.png`, `favicon.*`, `apple-touch-icon.png` — official GoPlan app icons
- `assets/plani-logo-*` — official PLANI logo at UI sizes
- `assets/*-original-1024.png` — original brand artwork supplied for this project

## Included in this update
- The official GoPlan app icon and PLANI logo. The AI assistant is labelled **PLANI / GoPlan AI**.
- Four themes: NATURAL, TIGERS CLASSIC, TIGERS NIGHT, and VINTAGE TIGERS.
- Light, dark, and system display modes; custom accent color; shared theme with a per-device override.
- A default device-only wallpaper setting, separate wallpaper overrides for Home / Wish list / Plans / Calendar, and an opt-in wallpaper sync switch.
- Automatic local backups in IndexedDB, manual backup, restore, and protected deletion. The latest five snapshots are retained. Theme and wallpaper setting changes are also backed up.
- Google OAuth requests `openid email profile` and Drive `appData` access. The UI can show the connected Google account email. Existing wish/plan Drive sync is retained, with shared theme and optional shared wallpaper data.
- PWA metadata and a service worker for caching the app shell after the first successful online visit.
- Startup guards for malformed local settings/data, and validation of imported photo and wallpaper data.

## Important scope and limitations

This project is still a static GitHub Pages app. Some planned capabilities need a secure backend and are **not active in this version**:
- PLANI AI chat, location search, sourced research, and outing-plan generation
- scheduled monitoring, in-app/OS push notifications, and notification scheduling
- server-side backups and cloud backup orchestration
- cross-device sync for AI conversations, saved AI plans, searches, notification settings, and AI memories

The current Google Drive sync covers the existing wishes and plans plus the theme and optional shared wallpaper. Local backups live in each browser/device's IndexedDB; they are not cloud backups and do not automatically move to another device. The app shell can be cached for offline opening, but Google Drive and future AI services still require a network connection.

## Google OAuth setup
1. Create or select a Google Cloud project and configure an OAuth 2.0 Web client.
2. Add the deployed GitHub Pages origin to Authorized JavaScript origins.
3. Enable the Google Drive API.
4. Enter the OAuth client ID in GoPlan's Google account settings.

Only the public OAuth client ID belongs in this browser app. Never commit a client secret or private API key to this repository. The user chooses their Google account during the OAuth flow; the app does not collect or store a Gmail password.

## Deploying with GitHub Pages
Extract this ZIP and copy the **contents inside `outing-manager-main/`** into the repository's published root. Keep `index.html`, `manifest.webmanifest`, `sw.js`, all icon files, and the `assets/` directory together. Do not put the folder one level deeper than the current published `index.html`.

## Verification

See `TEST_REPORT.md` for the second verification pass, the two fixes made, the test setup, and the remaining live-device/service checks.
