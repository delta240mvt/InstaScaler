# InstaScaler

Private Instagram growth and comment-to-DM automation for one administrator and up to five professional accounts. It runs natively on Cloudflare and uses Neon Serverless Postgres—no Redis, always-on process, Hyperdrive, Auth.js, or email login.

## Architecture

- `instascaler-web`: Next.js 16 UI built by OpenNext.
- `instascaler-core`: Hono API, login/password session, Meta OAuth/webhooks, reports and redirects.
- `instascaler-jobs`: Queue consumer, R2 recovery journal, Durable Object rate limits and scheduled Workflows.
- Neon Serverless: the only relational database.

Verified bundle sizes are below the Workers Free compressed-script limit. The application reserves at most 9,500 of the 10,000 free Queue operations per UTC day and keeps an R2 journal before publishing work.

## Local verification

```bash
npm ci
npm run db:generate
npx prisma validate
npm test
npm run typecheck
npm run lint
npm run cf:build:web
npx wrangler deploy --dry-run --config wrangler.web.jsonc
npx wrangler deploy --dry-run --config wrangler.core.jsonc
npx wrangler deploy --dry-run --config wrangler.jobs.jsonc
```

Generate administrator secrets with:

```bash
node scripts/generate-admin-secrets.mjs "your-long-password"
```

See [setup](docs/setup.md), [stack](docs/stack.md), and the runbooks in `docs/runbooks/`.

Deployment is intentionally manual through the `Deploy Cloudflare` GitHub Action. It migrates Neon once, then deploys Jobs, Core and Web. It does not change Meta settings automatically.
