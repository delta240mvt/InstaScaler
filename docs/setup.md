# Cloudflare Free setup

## 1. Create resources

1. Create a Neon project and copy its pooled/serverless `DATABASE_URL` (TLS required). Do not create Hyperdrive.
2. In Cloudflare create R2 bucket `instascaler-event-journal`.
3. Create Queues `instascaler-events` and `instascaler-events-dlq`.
4. Keep the Worker names from the three `wrangler.*.jsonc` files.

## 2. Set secrets

Generate local values:

```bash
node scripts/generate-admin-secrets.mjs "a-long-unique-password"
```

Set `DATABASE_URL`, `ENCRYPTION_KEY` and `APP_BASE_URL` on Core and Jobs. Set the remaining admin and Meta values from `.env.example` on Core. Set `META_GRAPH_API_VERSION` on Jobs when overriding the default API version. Use `wrangler secret put NAME --config wrangler.core.jsonc` or the Cloudflare dashboard; never commit values.

`ADMIN_PASSWORD_VERIFIER` is HMAC-SHA256(password, pepper). Changing either value invalidates future logins; existing sessions remain valid until `SESSION_SIGNING_KEY` is rotated.

## 3. Route one hostname to two Workers

Cloudflare route specificity sends API traffic to Core and everything else to Web. Configure these routes in the dashboard (replace the hostname):

- `app.example.com/api/*` → `instascaler-core`
- `app.example.com/webhook*` → `instascaler-core`
- `app.example.com/r/*` → `instascaler-core`
- `app.example.com/health` → `instascaler-core`
- `app.example.com/*` → `instascaler-web`

Set `APP_BASE_URL=https://app.example.com` and `META_REDIRECT_URI=https://app.example.com/api/instagram/callback`.

## 4. Database and deploy

```bash
npm ci
npm run db:generate
npm run db:migrate
npm run cf:build:web
npm run cf:deploy:jobs
npm run cf:deploy:core
npm run cf:deploy:web
```

The GitHub deployment workflow performs the same sequence and requires protected `production` environment secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `DATABASE_URL`.

## 5. Meta developer test app

While the app remains in development mode, add your Facebook/Instagram test user and use the exact OAuth redirect above. Configure the webhook callback as `https://app.example.com/webhook`, enter `META_WEBHOOK_VERIFY_TOKEN`, and subscribe to `comments` and `messages`. Production access still depends on Meta permissions/review; the code cannot bypass that external requirement.

## 6. Acceptance

Test login, connect up to five accounts, comment delivery, negative and positive follow confirmation, duplicate webhook, inbound DM trigger, delayed follow-up, hourly reconciliation, inbox reply, tracked redirect, public report and logout. Run `npm run test:e2e` with the `E2E_*` variables for the browser smoke subset.
