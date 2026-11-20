# GoPlan backend

This Worker is the secure server-side companion for the static GitHub Pages app.

## Services
- Cloudflare Workers: authenticated API and scheduled jobs.
- Cloudflare D1: per-Google-account state, conversations, saved AI plans, backups, watches, push subscriptions, and usage counters.
- OpenAI Responses API: PLANI answers with web search and source annotations.
- Web Push: browser notification delivery through VAPID.

No API secret belongs in index.html, GitHub Pages, or backend-config.js.

## Required setup
1. Install Node.js 22 or later and npm.
2. Create a Cloudflare account and authenticate Wrangler with npx wrangler login.
3. Run npx wrangler d1 create goplan-production.
4. Copy the returned database ID into wrangler.toml at database_id.
5. Run npx wrangler d1 migrations apply goplan-production --remote.
6. Run npm install.
7. Add secrets: OPENAI_API_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT.
8. Deploy with npx wrangler deploy.

The D1 database ID and secrets are deliberately not committed.

## API
- GET /api/health
- GET /api/account
- GET|PUT /api/state (optimistic revision check; HTTP 409 on concurrent edits)
- GET|POST /api/backups, GET /api/backups/:id, POST /api/backups/:id/restore
- GET|POST /api/conversations, PUT|DELETE /api/conversations/:id
- GET|POST /api/ai-plans, PUT|DELETE /api/ai-plans/:id
- POST /api/ai with action chat, search, or plan
- GET|PUT /api/notification-settings
- GET|POST /api/place-watches, DELETE /api/place-watches/:id
- GET /api/push/public-key, POST|DELETE /api/push/subscribe, POST /api/push/test

Every authenticated request includes a Google OAuth access token in Authorization: Bearer. The Worker checks it with Google's user-info endpoint and scopes each database query by account subject. Tokens are never stored.

## Important
- Cloud backups retain the latest five snapshots per account.
- The AI endpoint uses live web search for place searches and itinerary requests. API usage may incur charges on the configured OpenAI account.
- Place monitoring checks up to three watched places per user per 15-minute invocation and no more often than every six hours, within the configured notification window.
- Browser push requires permission and a subscription on each device. Device notification settings still apply.
- This backend has not been deployed to a real Cloudflare account. Live Google sign-in, AI billing, D1, and push delivery must be tested before production use.
