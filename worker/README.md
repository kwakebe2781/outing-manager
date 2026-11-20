# GoPlan cloud backend

This Cloudflare Worker is the secure backend for the GoPlan development build. It is deployed separately from GitHub Pages.

## API services

- Google ID-token validation (signature, issuer, audience, expiry, verified email).
- Cloud sync with per-account revisions, item timestamps, deletion tombstones, and HTTP 409 conflict handling.
- Automatic cloud snapshots: previous five sync states per account; list and restore through the profile UI.
- PLANI chat using the OpenAI Responses API and web search.
- PLANI one-day itinerary generation with Structured Outputs and source links.
- Place search and photo proxy through Google Places API (New).
- Saved-place monitoring for business name, status, and regular opening-hour changes.
- Web Push for place updates and outing reminders.
- Quiet hours: notifications are delivered only between 06:00 and 22:00 in the user's saved time zone. Quiet-hour notifications are queued for daytime; expired plan reminders are discarded.
- Account-data deletion for cloud records, AI usage, saved-place monitors, subscriptions and backup history.

## External services and account setup

Some external services require accounts, credentials, a payment method, or usage billing. The repository/service owner or a parent/guardian should manage account and billing setup. Never paste passwords, client secrets, API keys, private keys, or recovery codes into ChatGPT or commit them to Git.

### 1. Cloudflare D1

From the `worker/` directory:

```sh
npm install
npx wrangler login
npm run db:create
```

Copy the created database ID into `worker/wrangler.toml` at `database_id`, then apply the schema:

```sh
npm run db:migrate:remote
```

### 2. Google OAuth and Places

Create a Google OAuth 2.0 Web client. Add the deployed GitHub Pages origin to Authorized JavaScript origins:

- `https://kwakebe2781.github.io`

Enable Google Identity Services and Google Places API (New) for the project.

Set the same OAuth client ID in `worker/wrangler.toml` (`GOOGLE_CLIENT_ID`) and `config.js` (`googleClientId`). The OAuth client ID is public; do not use a client secret in the browser.

Set the Places API key as a Worker secret, not in the repository.

### 3. OpenAI and Web Push secrets

The current Worker defaults to model ID `gpt-6.2-astra`. The Responses API and web search are used for PLANI. If a different supported model is selected, update `OPENAI_MODEL`.

Generate VAPID keys:

```sh
npm run generate:vapid
```

Configure these Worker secrets:

```sh
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put GOOGLE_MAPS_API_KEY
npx wrangler secret put VAPID_PRIVATE_JWK
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_SUBJECT
```

Set `VAPID_SUBJECT` to a real contact URI (normally a mailto address) controlled by the service owner. The private JWK and API keys must remain secrets.

### 4. Deploy the Worker

```sh
npm run deploy
```

Copy the Worker URL (for example, `https://goplan-api.<account>.workers.dev`) into `config.js` as `apiBase`, without a trailing slash.

### 5. Verify the backend

- Open `<apiBase>/api/health` and check `ok: true`.
- Open `<apiBase>/api/config` and confirm the expected feature flags and public client/VAPID settings.
- Sign in to GoPlan and verify `/api/me`.
- Add a wish on one device; verify it appears on a second device logged in to the same account.
- Update from two devices at once. A conflict should return HTTP 409 and the client should merge rather than silently discard items.
- Change an item and confirm that a previous cloud snapshot appears in Profile → Cloud backups.
- Restore a cloud snapshot after making a local backup.
- Test PLANI chat, approved-memory recall, saved conversation history, structured itinerary generation and plan saving.
- Test place search, photo proxy, add to wishes, and saved-place monitoring.
- Test push permission, an outing reminder, a place update, and a notification generated during quiet hours. Confirm daytime delivery and expiry of reminders for plans already started.
- Test offline app opening after the first successful online load.

## Data, privacy and cost

- D1 stores account email/name, app data, AI conversation history, saved AI plans, explicitly approved memories, notification preferences, saved-place monitors, cloud snapshots, AI usage counts, and push subscription endpoints/keys.
- PLANI chat and itinerary inputs are sent from the Worker to OpenAI. Place searches and monitored place details are sent to Google Places.
- Cloudflare, Google and OpenAI may apply their own retention, processing, quotas, and pricing terms. Review the provider terms before enabling live use.
- Push subscription endpoints and keys are private and are never displayed in the app UI.
- Publish the privacy notice with real operator contact details before inviting other people to use the app.
- Local IndexedDB backups are separate from D1 cloud snapshots and optional Google Drive appData storage.

## API routes

- `GET /api/health`, `GET /api/config`
- `GET /api/me`
- `GET /api/sync`, `PUT /api/sync`
- `GET /api/backups`, `POST /api/backups/restore`
- `POST /api/plani/chat`, `POST /api/plani/itinerary`
- `POST /api/places/search`, `GET /api/places/photo?name=...`
- `GET/POST /api/places/watch`, `DELETE /api/places/watch/:id`
- `POST/DELETE /api/push/register`
- `POST /api/account/delete`

## Scheduled jobs

The cron trigger runs every five minutes (Cloudflare cron is UTC-based). Saved-place checks are throttled to once every six hours per watched place; reminder checks run at each trigger. Notifications are sent only in the user's 06:00–22:00 local window. Quiet-hour notifications with active subscriptions are queued and drained during the next allowed window.
