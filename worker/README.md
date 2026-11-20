# GoPlan API backend

This is the private server-side companion for the static GoPlan site. The public HTML must never contain AI keys, VAPID private keys, OAuth client secrets, or other server credentials.

## What it provides

- Cloudflare Workers API and 15-minute scheduled tasks.
- Cloudflare D1 storage partitioned by verified Google account ID.
- PLANI chat, sourced place search, and itinerary proposals through the OpenAI Responses API.
- User-approved AI memories, with a separate on/off switch for AI reference.
- Cloud backups (up to five), restore protection, and revision-based sync conflicts.
- Saved conversations, saved AI plans, and protected account-data deletion.
- Wikimedia Commons photo search/import with author, license, and source metadata. The Worker re-checks the file page and image URL before importing.
- In-app notifications, place monitoring, reminders, and Web Push using Web Crypto.

## Prerequisites

Use Node.js 22 or later. A Cloudflare account, a Google OAuth client, and an OpenAI API project are needed for the full service. Set up paid services with a parent or guardian. Never paste API keys or private keys into ChatGPT, GitHub source files, or the browser app.

## Deployment setup

Run these commands from this `worker` directory:

1. Install dependencies:

   `npm install`

2. Sign in to Cloudflare:

   `npx wrangler login`

3. Create the D1 database:

   `npx wrangler d1 create goplan-production`

4. Copy the database ID printed by Wrangler into `wrangler.toml`, replacing `REPLACE_WITH_D1_DATABASE_ID`.

5. Create a Google OAuth 2.0 Web application client in Google Cloud Console. Set its Authorized JavaScript origin to:

   `https://kwakebe2781.github.io`

   Add the same public Client ID to `GOOGLE_CLIENT_ID` in `wrangler.toml`. The identical Client ID is also entered in GoPlan's Google account settings. Do not create or expose a client secret in the static app. The app requests OpenID/email identity and the existing Google Drive app-data scope.

6. Apply the database migration:

   `npx wrangler d1 migrations apply goplan-production --remote`

7. Set the server-only secrets. The private values are entered only into Wrangler's secure prompt:

   - `npx wrangler secret put OPENAI_API_KEY`
   - `npx wrangler secret put VAPID_PUBLIC_KEY`
   - `npx wrangler secret put VAPID_PRIVATE_KEY`
   - `npx wrangler secret put VAPID_SUBJECT`

   Generate a VAPID key pair locally using a trusted Web Push key generator. The public key is used by the browser to subscribe; the private key must remain a Worker secret. A typical subject is a project contact URI such as `mailto:owner@example.com`. Do not share the private key.

8. Deploy:

   `npx wrangler deploy`

9. Open GoPlan, open Google account settings, enter the public OAuth Client ID and the deployed Worker URL (for example, `https://goplan-api.<your-account>.workers.dev`), then save both settings and sign in.

The D1 ID and credentials are intentionally placeholders/not committed. The Worker must not be deployed while either placeholder remains.

## API routes

- `GET /api/health`
- `GET /api/account`
- `GET|PUT /api/state` — optimistic revision check; HTTP 409 on concurrent changes.
- `GET|POST /api/backups`, `GET /api/backups/:id`, `POST /api/backups/:id/restore`
- `DELETE /api/account/data` — creates a full backup first, then clears account data after user confirmation.
- `GET|POST /api/conversations`, `PUT|DELETE /api/conversations/:id`
- `GET|POST /api/ai-plans`, `PUT|DELETE /api/ai-plans/:id`
- `POST /api/ai` with `chat`, `search`, or `plan` action.
- `GET|POST /api/memories`, `PUT|DELETE /api/memories/:id`; saving requires explicit approval.
- `GET|PUT /api/ai-settings` — AI memory-reference preference.
- `GET|PUT /api/notification-settings`
- `GET /api/notifications`, `POST /api/notifications/:id/read`
- `GET|POST /api/place-watches`, `PUT /api/place-watches/:id` (pause/resume), `DELETE /api/place-watches/:id`
- `GET /api/images/search?q=...`, `POST /api/images/import`
- `GET /api/push/public-key`, `POST|DELETE /api/push/subscribe`, `POST /api/push/test`

Authenticated API routes require a short-lived Google OAuth access token in the Authorization Bearer header. The Worker validates the token against Google's token-info and user-info endpoints and scopes D1 records to the returned Google account subject. Raw access tokens are not stored.

## Operational limits and verification

- Cloud backups retain the latest five snapshots per Google account. A backup snapshot includes the latest 20 conversations and saved AI plans, 50 approved memories, 100 watched places, and 50 recent in-app notifications. Each full snapshot has an application-level size limit; very large photo collections may need object storage such as Cloudflare R2 before production use.
- The shared state endpoint rejects stale revisions instead of silently applying last-writer-wins.
- PLANI uses the configured OpenAI account. API calls can incur charges; configure spend limits and review usage with a parent or guardian.
- Place monitoring processes up to three due places for each account per scheduled run, with a minimum six-hour interval between checks. A source URL is required before a place-change notification is sent.
- Web Push requires browser permission and a separate subscription on every device. Safari/iPhone web-push behavior must be tested on a real device after adding GoPlan to the Home Screen.
- Scheduled jobs run every 15 minutes. The app's reminder and monitoring window is controlled by each user's settings (default 06:00–22:00 Japan time).
- GitHub Actions checks syntax, IDs, manifest assets, Wrangler TOML parsing, and basic Worker unit tests. These checks do not prove live OAuth, D1, AI billing, push delivery, iPhone installation, or offline behavior.
