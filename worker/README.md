# GoPlan cloud backend (development branch)

This repository now includes a Cloudflare Worker backend scaffold for GoPlan. It is intentionally separate from the GitHub Pages frontend and is deployed independently.

## Services provided

- Google ID-token verification on the server (signature, issuer, audience, expiry and verified email).
- Per-account cloud sync with revision checks. Concurrent writes return HTTP 409 instead of silently overwriting another device.
- PLANI chat using the OpenAI Responses API and server-side web search. The OpenAI key stays in a Worker secret.
- Place search and photo proxy through Google Places API (New).
- Saved-place monitoring for business status/name/opening-hours changes.
- Web Push delivery for place updates and outing reminders.
- Account-data deletion endpoint for server-side records.

## Important setup (adult/owner-managed accounts)

Some external services require accounts, API credentials, usage billing, or a payment method. Have the repository/service owner or a parent/guardian manage those settings. Never paste passwords, private keys, client secrets, or API keys into ChatGPT or commit them to Git.

### 1. Create the D1 database

From this folder:

\`\`\`sh
npm install
npx wrangler login
npm run db:create
\`\`\`

Copy the generated database ID into \`worker/wrangler.toml\` at \`database_id\`.

Apply the schema:

\`\`\`sh
npm run db:migrate:remote
\`\`\`

### 2. Configure Worker variables and secrets

Set the Google OAuth Web client ID in \`worker/wrangler.toml\`. Its Authorized JavaScript origins must include:

- \`https://kwakebe2781.github.io\`
- the local development origin used during testing

Enable Google Identity Services and Google Places API (New) in the associated Google Cloud project.

Generate a VAPID key pair:

\`\`\`sh
npm run generate:vapid
\`\`\`

Set the values as Worker secrets (do not commit them):

\`\`\`sh
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put GOOGLE_MAPS_API_KEY
npx wrangler secret put VAPID_PRIVATE_JWK
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_SUBJECT
\`\`\`

For \`VAPID_PRIVATE_JWK\`, paste the complete one-line JSON printed by the generator. For \`VAPID_PUBLIC_KEY\`, paste the public key. Set \`VAPID_SUBJECT\` to a real contact address controlled by the service owner.

### 3. Deploy the API

\`\`\`sh
npm run deploy
\`\`\`

Copy the Worker URL (for example, \`https://goplan-api.<account>.workers.dev\`) into \`config.js\` as \`apiBase\`. Do not add a trailing slash.

### 4. Configure the frontend

Edit \`config.js\`:

- \`apiBase\`: deployed Worker URL
- \`googleClientId\`: same Google OAuth Web client ID as the Worker

Commit the public client ID and API URL only. Never place the OpenAI key, Places key, VAPID private key, or a Google client secret in frontend code.

### 5. Test

- Open the app on the GitHub Pages origin.
- Sign in with Google.
- Confirm \`/api/health\` returns \`ok: true\`.
- Add a wish on one device, reload another signed-in device, and verify cloud sync.
- Test a deliberately conflicting write and ensure the API returns 409 rather than silently discarding data.
- Test PLANI, place search/photo, push permission, a saved-place watch, and a scheduled reminder.
- Verify the app still opens offline after its first successful online load.

## Data and privacy notes

- The Worker stores account email/name, app data, saved-place watch records, AI daily usage counts, and push endpoints in D1.
- Place monitoring calls Google Places periodically. Provider availability, freshness, coverage, and pricing are determined by Google.
- PLANI requests are sent to the configured OpenAI API from the Worker. Do not send passwords or sensitive personal information to PLANI.
- Push subscription endpoints and keys are private and are never shown in the app UI.
- The app should publish a privacy notice and contact details before inviting other people to use it.
- Cloud backup and local IndexedDB backup are separate. Drive appData backup remains a separate user-authorized feature; appDataFolder is hidden and is not a user-visible shared Drive folder.
- Google Drive appData contents are per-user and are not shareable through Drive UI. See Google documentation: https://developers.google.com/workspace/drive/api/guides/appdata

## Current deployment status

The Worker is source code only until the owner creates the D1 database, configures secrets, and deploys it. The frontend remains usable without these optional cloud services, but cloud sync, PLANI, saved-place monitoring, and push notifications require a configured API.

## Cloud API routes

- \`GET /api/health\`
- \`GET /api/config\`
- \`GET /api/me\` (Google ID token required)
- \`GET /api/sync\`, \`PUT /api/sync\`
- \`POST /api/plani/chat\`
- \`POST /api/places/search\`
- \`GET /api/places/photo?name=...\`
- \`GET/POST /api/places/watch\`, \`DELETE /api/places/watch/:id\`
- \`POST/DELETE /api/push/register\`
- \`POST /api/account/delete\`

## Development notes

- Scheduled checks run every 15 minutes (UTC). Place monitors compare the business name/status/regular weekday hours. Outing reminders target approximately 30 minutes before a saved plan's local time.
- Sync writes are revision-checked. This prevents unannounced overwrites; the client must merge changes and retry on conflict.
- Review Cloudflare, Google and OpenAI product terms, quotas and usage costs before enabling live service.
