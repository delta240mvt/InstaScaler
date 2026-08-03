# InstaScaler by delta240mvt

<div align="center">

<pre>
 ██╗███╗   ██╗███████╗████████╗ █████╗ ███████╗ ██████╗ █████╗ ██╗     ███████╗██████╗
 ██║████╗  ██║██╔════╝╚══██╔══╝██╔══██╗██╔════╝██╔════╝██╔══██╗██║     ██╔════╝██████╔╝
 ██║██╔██╗ ██║███████╗   ██║   ███████║███████╗██║     ███████║██║     █████╗  ██╔══██╗
 ██║██║╚██╗██║╚════██║   ██║   ██╔══██║╚════██║██║     ██╔══██║██║     ██╔══╝  ██║  ██║
 ██║██║ ╚████║███████║   ██║   ██║  ██║███████║╚██████╗██║  ██║███████╗███████╗██████╔╝
 ╚═╝╚═╝  ╚═══╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝ ╚═════╝╚═╝  ╚═╝╚══════╝╚══════╝╚═════╝
                         I N S T A G R A M   A U T O M A T I O N
</pre>

**A private, Cloudflare-native Instagram growth console for turning comments into conversations.**

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange?style=flat-square&logo=cloudflare)](https://workers.cloudflare.com/)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![Neon](https://img.shields.io/badge/Database-Neon%20Serverless-00e599?style=flat-square)](https://neon.tech/)
[![Meta Graph API](https://img.shields.io/badge/Instagram-Meta%20Graph%20API-E1306C?style=flat-square&logo=instagram)](https://developers.facebook.com/docs/instagram-api/)
[![License](https://img.shields.io/badge/License-MIT-4a8d83.svg?style=flat-square)](LICENSE)

**Single administrator · Up to five professional Instagram accounts · Free-plan conscious by design**

</div>

---

Most Instagram automation tools make a simple interaction feel like a campaign platform. InstaScaler keeps the useful part: a comment becomes a private conversation, the right person receives the right link, and every delivery is observable.

No always-on server. No Redis. No Hyperdrive. No email-login maze. Just a focused admin console, official Instagram APIs, Cloudflare Workers and a serverless Neon database.

```text
  INSTASCALER DELIVERY LOOP
  ┌─────────────────────────────────────────────────────────────────────┐
  │                                                                     │
  │  COMMENT                                                            │
  │     │  signed Meta webhook                                          │
  │     ▼                                                               │
  │  OPENING DM                                                         │
  │     │  always first when enabled                                    │
  │     ▼                                                               │
  │  FOLLOW CHECK                                                       │
  │     ├── already follows ───────────────┐                            │
  │     └── follow prompt → tap again ─────┤                            │
  │                                         ▼                            │
  │  FREEBIE DM  →  exact campaign link  →  OPTIONAL FOLLOW-UP           │
  │                                                                     │
  │  idempotent Neon status · account rate guard · R2 recovery journal   │
  └─────────────────────────────────────────────────────────────────────┘
```

## What InstaScaler does

| Capability | What it means in practice |
| --- | --- |
| Comment-to-DM campaigns | Match a keyword, any word, any post, a specific post or the next post/Reel. |
| Opening DM | Send a warm first message before asking for a follow or revealing the freebie. |
| Follow-gated delivery | Check the user's follow status through Meta, prompt only when necessary, then continue after confirmation. |
| Exact destination links | Send the URL configured in the campaign. Tracked redirects are optional. |
| Public comment replies | Add one or more public replies with deterministic random selection. |
| Follow-up messages | Queue a delayed message after the freebie, up to 24 hours later. |
| Multi-account workspace | Manage up to five connected professional Instagram accounts from one console. |
| Inbox and analytics | See conversations, delivery statuses, clicks, keywords and follower snapshots. |
| Next post or Reel | Poll hourly and attach the first new publication to waiting campaigns in order. |
| Production recovery | Keep accepted events in R2 until Neon records a terminal result. |

## Runtime shape

```text
                         ┌──────────────────────┐
                         │  instascaler-web     │
                         │  Next.js + OpenNext  │
                         └──────────┬───────────┘
                                    │ service binding / routes
                         ┌──────────▼───────────┐
                         │  instascaler-core    │
                         │  Hono API + Meta     │
                         └──────┬────────┬──────┘
                                │        │
                         signed │        │ serverless SQL
                         events  │        ▼
                                ▼   ┌───────────────┐
                         ┌────────┐│ Neon Postgres │
                         │ R2     │└───────────────┘
                         │journal │
                         └───┬────┘
                             │ compact Queue message
                             ▼
                    ┌─────────────────────────┐
                    │  instascaler-jobs       │
                    │  Queue + Workflows      │
                    │  Durable Object limits  │
                    └────────────┬────────────┘
                                 │ official Graph API side effects
                                 ▼
                            Instagram
```

### The event path

1. Meta sends a signed webhook to Core.
2. Core validates it, writes the full envelope to R2 and publishes a compact Queue message.
3. Jobs reserves an idempotent delivery in Neon.
4. A per-account Durable Object protects Meta sends from bursts.
5. Jobs sends the DM/comment/follow-up through the Instagram Graph API.
6. Neon records `SENT`, `SKIPPED`, `RETRYING` or `FAILED`.
7. The R2 journal is deleted only after terminal processing.

This makes duplicate webhooks, repeated button taps and Queue redelivery safe to handle.

## Free-plan operating envelope

InstaScaler deliberately reserves headroom instead of spending every advertised limit.

| Guardrail | Application budget |
| --- | ---: |
| Incoming events | 1,000 per UTC day |
| Estimated Queue operations | 9,500 per UTC day |
| Workflow steps | 2,800 per UTC day |
| Meta sends per connected account | 200 per hour |
| Connected accounts | 5 |
| Follow-up delay | 0–24 hours |
| Recovery sweep | Every hour, at minute 7 |

A follow-gated conversion normally uses two or three incoming events: the comment, the confirmation tap, and—when needed—the second follow confirmation. When a rate guard is hit, the event is retried; it is not silently discarded.

## Retry and resilience

Transient Queue work uses bounded exponential backoff:

```text
attempt 1   60 seconds
attempt 2   120 seconds
attempt 3   240 seconds
attempt 4   480 seconds
attempt 5   960 seconds
maximum     1 hour between retries
```

The Queue consumer allows five retries. If a delivery still cannot complete, the R2 envelope remains available to `RecoverJournalWorkflow`, which scans for retrying events hourly. Permanent Meta errors are recorded as terminal failures; expired tokens mark the account for reconnection.

## Quick start

### Prerequisites

- Node.js 20+
- A Neon Postgres database with a TLS connection string
- Cloudflare account with Workers, R2 and Queues enabled
- Meta developer app with Instagram webhook and messaging permissions

### Local setup

```bash
git clone https://github.com/delta240mvt/InstaScaler.git
cd InstaScaler
npm ci
copy .env.example .env
npm run db:generate
npm run db:migrate
npm run dev
```

Generate the administrator verifier and signing secrets locally:

```bash
node scripts/generate-admin-secrets.mjs "your-long-unique-password"
```

Never commit `.env` or paste real secrets into this README.

## Production deployment

Create these Cloudflare resources once:

```text
R2 bucket       instascaler-event-journal
Queue           instascaler-events
Dead-letter     instascaler-events-dlq
Workers         instascaler-web, instascaler-core, instascaler-jobs
```

Then run:

```bash
npm ci
npm run db:generate
npm run db:migrate
npm run cf:build:web
npm run cf:deploy:jobs
npm run cf:deploy:core
npm run cf:deploy:web
```

Arm the hourly scheduler once after deployment:

```bash
curl -X POST https://YOUR-JOBS-WORKER/internal/bootstrap \
  -H "Authorization: Bearer $SCHEDULER_BOOTSTRAP_TOKEN"
```

Detailed setup, route configuration and Meta instructions live in [`docs/setup.md`](docs/setup.md). The stack decisions are documented in [`docs/stack.md`](docs/stack.md).

## Cloudflare routes

For a custom hostname, route API traffic to Core and everything else to Web:

```text
/api/*      → instascaler-core
/webhook*   → instascaler-core
/r/*        → instascaler-core
/health     → instascaler-core
/*          → instascaler-web
```

With the default workers.dev setup, keep `APP_BASE_URL`, the Meta redirect URL and the webhook callback aligned with the actual hostname.

## Environment contract

Use [`.env.example`](.env.example) as the complete placeholder list. The important production values are:

| Variable | Used by | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Core, Jobs | Neon serverless Postgres connection |
| `APP_BASE_URL` | Core, Web | Canonical public URL |
| `ENCRYPTION_KEY` | Core, Jobs | Encrypt stored Meta access tokens |
| `SESSION_SIGNING_KEY` | Core | Sign the admin session cookie |
| `ADMIN_LOGIN` | Core | Single administrator login |
| `ADMIN_PASSWORD_VERIFIER` | Core | HMAC verifier; the password is never stored |
| `ADMIN_PASSWORD_PEPPER` | Core | Password verification pepper |
| `META_APP_ID` / `META_APP_SECRET` | Core | Meta OAuth application credentials |
| `META_REDIRECT_URI` | Core | OAuth callback URL |
| `META_WEBHOOK_VERIFY_TOKEN` | Core | Meta webhook verification |
| `SCHEDULER_BOOTSTRAP_TOKEN` | Jobs | Protect the scheduler bootstrap endpoint |

Set secrets with `wrangler secret put NAME --config wrangler.core.jsonc` or the Cloudflare dashboard. Do not use Hyperdrive: Neon is accessed through the serverless Prisma adapter.

## Meta webhook setup

For the workers.dev deployment, the callback is:

```text
https://instascaler-core.delta240mvt.workers.dev/webhook
```

The verification token is the value configured as `META_WEBHOOK_VERIFY_TOKEN`.

Subscribe the Meta app to the events required by your account and keep the OAuth redirect exactly equal to:

```text
https://instascaler-web.delta240mvt.workers.dev/api/instagram/callback
```

Meta development mode requires the Instagram account to be assigned as a tester. Production availability still depends on Meta permissions and review.

## Project map

```text
app/                         Next.js UI routes and dashboard screens
components/                  UI and campaign builder
lib/meta/                    Instagram Graph API client
lib/delivery/                Comment, DM, follow-gate and follow-up flow
lib/jobs/                    Budgets, rate guards and job contracts
lib/db/                      Neon + Prisma adapter
workers/core/                Authenticated API and webhook Worker
workers/jobs/                Queue consumer, Workflows and Durable Objects
prisma/                      Schema and migrations
docs/                        Setup, stack and operational runbooks
```

## Useful commands

| Task | Command |
| --- | --- |
| Start Web locally | `npm run dev` |
| Generate Prisma client | `npm run db:generate` |
| Apply Neon migrations | `npm run db:migrate` |
| Run unit/contract tests | `npm test` |
| Typecheck | `npm run typecheck` |
| Build OpenNext for Cloudflare | `npm run cf:build:web` |
| Deploy Web | `npm run cf:deploy:web` |
| Deploy Core | `npm run cf:deploy:core` |
| Deploy Jobs | `npm run cf:deploy:jobs` |
| Start Core locally | `npm run cf:dev:core` |
| Start Jobs locally | `npm run cf:dev:jobs` |

## Production acceptance checklist

- [ ] Login with the administrator account.
- [ ] Connect one Instagram professional account.
- [ ] Receive a test comment from a separate Instagram account.
- [ ] Verify opening DM arrives before the follow check.
- [ ] Test both paths: already following and not following.
- [ ] Confirm the freebie contains the exact configured destination URL.
- [ ] Confirm optional public reply and delayed follow-up.
- [ ] Test duplicate webhook delivery and repeated button taps.
- [ ] Verify a `next post or reel` campaign attaches after the next publication.
- [ ] Inspect `/health`, diagnostics and failed-job recovery.

## Security posture

- Admin access is one login protected by a signed, host-only cookie.
- Meta signatures are verified before webhook processing.
- Access tokens are encrypted at rest.
- Queue payloads contain a journal key, not the full event or token.
- Neon is accessed serverlessly; there is no persistent connection pool.
- Operational records are retained only as long as the runbooks require.
- Real credentials belong in Cloudflare Secrets and local `.env`, never in Git.

## Roadmap

- [x] Cloudflare-native Web, Core and Jobs Workers
- [x] Neon Serverless Postgres with Prisma adapter
- [x] R2 journal + Queue delivery with idempotency
- [x] Follow-gated freebie delivery
- [x] Opening DM and delayed follow-up flow
- [x] Public reply variants and tracked links
- [x] Hourly reconciliation, recovery and next-post attachment
- [ ] Expanded campaign branching and multi-button journeys
- [ ] Richer per-campaign conversion analytics
- [ ] Custom domain and automated production deploy pipeline

## FAQ

**Does InstaScaler require Redis?**
No. Queues, R2, Durable Objects and Neon cover the event, retry and state requirements.

**Does the app send the freebie before checking a follow?**
No. When follow-gating is enabled, the configured opening DM goes first. The follow status is checked before the freebie is sent.

**What happens if Instagram or Neon is temporarily unavailable?**
The delivery remains retryable. Queue backoff and the hourly R2 recovery workflow protect the event from being lost.

**Can it handle several Instagram accounts?**
Yes, up to five connected professional accounts in the current Free-plan design.

**Where is the exact link configured?**
In the campaign builder. InstaScaler sends that destination URL directly; tracking is optional.

**Is this a SaaS product?**
No. This instance is a private operator console for `delta240mvt`.

## License

MIT — see [`LICENSE`](LICENSE) for details.

---

<div align="center">

**InstaScaler by delta240mvt**

*Comments in. Conversations out.*

</div>
