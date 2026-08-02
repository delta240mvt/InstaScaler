# Cloudflare-native migration design

## Summary

InstaScaler will be rebuilt as a Cloudflare-native, single-administrator
application while keeping its Next.js user interface and all private Instagram
automation features. The target infrastructure is Cloudflare Workers Free plus
Neon Free. The expected ceiling is 1,000 incoming comment or DM events per day.

The system will use OpenNext for the web interface, native Workers for the API
and background processing, Cloudflare Queues for event delivery, selective
Cloudflare Workflows for durable maintenance processes, Durable Objects for
rate limiting, R2 for a durable webhook ingress journal, and Neon Serverless
PostgreSQL for persistent application data. It will not use Hyperdrive, Redis,
BullMQ, an always-on process, Vercel, Resend, or a paid infrastructure service.

## Goals

- Keep all private dashboard and Instagram automation capabilities.
- Run within Cloudflare Workers Free and Neon Free at up to 1,000 incoming
  comment or DM events per day.
- Support one administrator and up to five connected Instagram accounts.
- Require an Instagram follow before delivering a freebie when a campaign
  enables the follow gate.
- Provide reliable, idempotent processing with retries and diagnostics.
- Preserve accepted webhook events across a Queue or Neon outage longer than
  the Free queue retention window.
- Retain detailed operational history for 90 days and daily aggregates
  indefinitely.
- Use direct Neon serverless connectivity without Hyperdrive.

## Non-goals

- Multi-user accounts, workspaces, invitations, roles, or billing.
- Public marketing, comparison, agency, SEO, or public template pages.
- Migrating existing production data; the new deployment starts with a fresh
  database.
- Supporting more than five Instagram accounts on the Free architecture.
- Automatically upgrading to paid infrastructure or generating usage charges.

## Platform constraints

The design treats Free-plan limits as hard capacity limits, not soft billing
thresholds.

- Workers Free: 100,000 requests per day and 10 ms CPU per invocation.
- Queues Free: 10,000 operations per day and 24-hour message retention. A
  successful message normally consumes one write, one read, and one delete.
- Workflows Free: 3,000 steps per day, 1 GB-month of stored state, and a 10 ms
  CPU limit per step. Workflow state is retained for three days by default.
- R2 Free: 10 GB-month storage, one million Class A operations, and ten million
  Class B operations per month.
- Neon Free: 100 CU-hours per month and 0.5 GB storage per project.

The implementation must fail closed when a hard platform limit is reached. It
must never silently switch to a paid plan or a paid dependency.

## Runtime architecture

The application is divided into three independently deployable Workers. This
keeps each bundle and each invocation focused enough for the Workers Free CPU
and script-size limits.

### Web Worker

The Web Worker runs Next.js 16 through `@opennextjs/cloudflare`. It owns:

- the authenticated dashboard;
- campaign and automation screens;
- inbox, logs, reports, and diagnostics screens;
- public shared reports;
- privacy, terms, data deletion, and Meta App Review pages.

It does not bundle Prisma, Meta processing, Queues consumers, or Workflows. It
calls the Core Worker API. Static output and assets are served without invoking
database code.

### Core Worker

The Core Worker exposes a small HTTP API, preferably using Hono. It owns:

- administrator login, logout, and session verification;
- CRUD operations for Instagram accounts, campaigns, reports, and settings;
- Instagram OAuth callbacks;
- Meta webhook verification and ingestion;
- durable webhook journaling in R2;
- tracked-link redirects;
- public-report data endpoints;
- direct Neon database access;
- Queue production.

Public requests are routed as follows:

```text
/api/*       -> Core Worker
/webhook/*   -> Core Worker
/r/*         -> Core Worker
/*           -> Web Worker
```

### Jobs Worker

The Jobs Worker is not a public application API. It owns:

- Queue consumption;
- Instagram DM, postback, public-reply, and follow-up processing;
- the per-account rate-limiting Durable Object;
- hourly reconciliation Workflows;
- daily maintenance Workflows;
- job diagnostics and recovery state.

The Core and Jobs Workers share domain interfaces and Neon-backed repositories,
but their entrypoints and bundles remain separate.

## Database architecture

Neon remains PostgreSQL. Prisma remains the ORM and migration tool.

- Replace `pg` and `@prisma/adapter-pg` with `@neondatabase/serverless` and
  `@prisma/adapter-neon`.
- Workers connect directly to Neon over the serverless driver's HTTP or
  WebSocket transport.
- Store `DATABASE_URL` as a Cloudflare Secret for Core and Jobs Workers.
- Run Prisma migrations locally or in CI against the direct migration URL.
- Never execute migrations during a Worker deployment or runtime request.
- Keep transactions where the domain requires atomicity.
- Do not add Hyperdrive.

The schema starts fresh and removes NextAuth, User, Account, Session,
VerificationToken, Workspace, WorkspaceMember, and WorkspaceInvitation models.
Domain records no longer carry workspace ownership.

The retained domain includes:

- Instagram accounts, limited to five;
- campaigns and automations;
- webhook and processed-event deduplication records;
- DM delivery logs;
- tracked links and clicks;
- follower snapshots;
- public report shares;
- daily aggregate statistics;
- operational events and job runs.

Records store normalized fields rather than complete raw webhook bodies. The
daily retention Workflow aggregates eligible data before deleting detailed DM,
webhook, and operational records older than 90 days. Daily aggregates remain
indefinitely. Diagnostics query `pg_database_size` and warn at 70% and 85% of
the Neon Free storage allowance.

## Authentication and authorization

The application has exactly one administrator. It has no registration, email
login, password-reset email, or external identity provider.

- Store the administrator login, password verifier, password pepper, and
  session signing key as Cloudflare Secrets. The verifier is generated offline
  as HMAC-SHA-256 of the password with the pepper. Login computes the same HMAC
  through Web Crypto and compares fixed-length bytes without early exit.
- Issue a signed session cookie with `HttpOnly`, `Secure`, and
  `SameSite=Strict` attributes and a seven-day expiry.
- Validate the session on every private page and API operation.
- Validate request origin on state-changing browser requests.
- Use a Durable Object to limit login attempts to five per 15-minute window.
- Change or recover the password by replacing the Cloudflare Secret.

Meta webhook endpoints, OAuth callbacks, tracked-link redirects, shared
reports, and required legal pages use explicit route-specific security instead
of the administrator session.

## Event and DM processing

### Ingestion and idempotency

The Core Worker verifies the Meta signature and performs minimal payload
validation. It writes a compact event envelope to R2 under a deterministic
event key, then publishes a Queue message containing that key. It returns
success to Meta only after both operations succeed. If Queue publication fails,
the R2 object remains available to the recovery schedule.

The Jobs Worker loads the envelope, normalizes the event, and inserts a
deterministic deduplication record in Neon. It deletes the R2 envelope only
after Neon has durably recorded the terminal result. Database uniqueness
constraints make duplicate webhooks, Queue retries, repeated button taps, and
hourly reconciliation safe. Every external Meta side effect also has a
deterministic delivery key.

### Standard campaign flow

1. Receive and verify the Meta webhook.
2. Journal the event envelope in R2.
3. Publish the R2 event key to Queue.
4. Deduplicate the event in Neon.
5. Load the Instagram account and matching active automations.
6. Match the configured keywords and media targeting rules.
7. Reserve capacity in the rate-limiting Durable Object.
8. Send the configured private and optional public reply through Meta.
9. Persist the result and tracked-link metadata, then delete the R2 envelope.

### Follow gate

Each campaign can enable `requireFollowBeforeFreebie`.

When disabled, a matching user receives the normal freebie flow. When enabled:

1. Send an opening DM asking the user to follow the business and press the
   confirmation button.
2. Process the resulting postback through Queue.
3. Query Meta's `is_user_follow_business` state at that moment.
4. If the user follows the business, deliver the freebie exactly once.
5. If the user does not follow it, send the configured reminder and allow a
   later retry.

The user cannot receive the protected freebie merely by clicking the button.
The current follow state must be confirmed by Meta.

### Follow-ups and retries

Normal jobs and follow-ups up to 24 hours use Queues. This matches the existing
Instagram messaging window and the Free queue delay limit. Workflows do not run
for every ordinary comment or DM because the 3,000-step daily allowance would
be exhausted at the target traffic.

Transient network errors, Meta `429` responses, and Meta `5xx` responses retry
with bounded exponential backoff. Permanent validation and permission errors
do not retry. An invalid or expired Instagram token pauses only that account and
marks it as requiring reconnection.

## Workflows and schedules

Workflows are reserved for low-volume, durable coordination:

- hourly comment reconciliation for each of at most five Instagram accounts;
- hourly recovery of R2 envelopes not yet recorded in Neon;
- daily token refresh;
- daily next-reel attachment;
- daily follower snapshots;
- daily log aggregation and retention;
- recovery of jobs deferred after a transient failure budget is exhausted.

The hourly reconciler starts one bounded instance per connected account. It
finds comments missed by webhooks and publishes the same idempotent Queue jobs
used by webhook ingestion. It never sends a DM directly.

The implementation records estimated Workflow steps and Queue jobs per UTC day.
It stops optional maintenance before exhausting hard limits. Security work,
token validity, and queued customer-visible deliveries take priority over
analytics refreshes.

## Capacity policy

At the target traffic, a full follow-gated conversion can generate three Queue
messages: the comment, the postback, and the optional follow-up. With the normal
three Queue operations per message, 1,000 full conversions consume about 9,000
of the 10,000 daily operations.

The system therefore:

- keeps Queue payloads below 64 KB;
- avoids creating separate jobs for steps that can complete inside one
  consumer invocation;
- bounds retries and records deferred recovery in Neon;
- postpones non-critical reconciliation when daily job estimates are high;
- shows estimated daily Queue and Workflow use in diagnostics;
- never attempts paid overflow.

This target assumes ordinary transient-error rates. A broad Meta or Neon outage
can delay recovery until the next UTC allowance window. The R2 journal retains
the accepted event until Neon records its terminal result, preventing Queue's
24-hour retention limit from losing it. Reprocessing must not produce duplicate
messages.

## Error handling and observability

Delivery records use these states:

- `queued`;
- `processing`;
- `sent`;
- `skipped`;
- `retrying`;
- `failed`.

The Jobs Worker writes the final error classification and relevant Meta error
code to Neon before acknowledging permanently failed work. A Dead Letter Queue
is a short-lived safety buffer, not the diagnostic source of truth, because
Free queues retain messages for only 24 hours.

The private diagnostics screen displays:

- last Cron and Workflow executions;
- errors grouped by Instagram account;
- token and reconnection state;
- jobs accepted today and estimated Queue operations;
- failed jobs eligible for manual replay;
- Neon database size and retention warnings;
- the last successful hourly reconciliation for each account.

There is no Redis heartbeat. Job-run and schedule records in Neon provide the
health signal.

## Product scope

### Retained

- Dashboard and statistics.
- Up to five Instagram accounts.
- Instagram connect, reconnect, and disconnect flows.
- Campaigns for one post, any post, and the next reel.
- Comment keyword and inbound DM keyword triggers.
- Public reply variants and personalization.
- Optional follow-before-freebie enforcement.
- Opening DM, buttons, postback, and fallback behavior.
- Immediate and delayed follow-up up to 24 hours.
- CSV campaign import.
- Conversation inbox.
- Delivery logs and diagnostics.
- Tracked links and click analytics.
- Follower history.
- Public reports with unguessable share identifiers.
- Privacy, terms, data deletion, and Meta App Review pages.
- Campaign templates inside the private builder.

### Removed

- Public landing and marketing pages.
- ManyChat comparison, agency, and SEO pages.
- Public campaign-template directory.
- Users, workspaces, members, roles, and invitations.
- Billing and plan usage limits.
- NextAuth, magic links, and Resend.
- BullMQ, Redis, and the persistent Node worker.
- Vercel configuration, Vercel Cron, and Vercel Analytics.

Branding and the product name do not change during this migration.

## Testing strategy

### Unit tests

- Session creation, validation, expiry, and login throttling.
- Meta signature verification.
- Keyword and campaign matching.
- Deduplication and deterministic delivery identifiers.
- Rate-limit reservation behavior.
- Retry and permanent-error classification.
- Retention cutoffs and daily aggregation.
- Five-account enforcement.

### Integration tests

- Core and Jobs Workers in the Cloudflare local runtime.
- Queue production, consumption, retry, and delay behavior.
- Follow gate with non-follower, follower, repeated click, and duplicate webhook.
- Prisma repositories against a temporary Neon branch.
- Workflow scheduling and bounded reconciliation.
- Protected and public route behavior.

### Build and end-to-end verification

- Lint, typecheck, and Vitest suites pass.
- OpenNext and both native Worker bundles build within Free limits.
- Local previews run in the actual Cloudflare `workerd` runtime.
- A browser test covers login, campaign creation, account selection, reports,
  and diagnostics.
- A dedicated Instagram test account covers the complete Meta workflow.

## Acceptance criteria

- A matching comment produces the configured DM.
- A non-follower cannot receive a follow-protected freebie.
- A user receives the protected freebie exactly once after Meta confirms follow.
- Duplicate webhooks and button taps do not duplicate delivery.
- A delayed follow-up survives process and deployment restarts.
- Hourly reconciliation recovers a webhook-missed comment.
- An invalid token pauses only its Instagram account.
- Dashboard, inbox, public reports, and tracked links return correct data.
- Detailed logs expire after 90 days and aggregates remain.
- Web, Core, and Jobs deployments fit Workers Free limits.
- The workload uses no paid service and cannot produce automatic usage charges.

## Deployment sequence

1. Create the new Prisma schema and Neon Free project.
2. Build and validate the Core and Jobs Workers with Neon Serverless.
3. Replace BullMQ paths with Queue producers and consumers.
4. Implement the Durable Object, Workflows, and Cron Triggers.
5. Separate the Next.js UI into the OpenNext Web Worker.
6. Deploy all Workers to test `workers.dev` routes.
7. Configure Cloudflare Secrets and apply Prisma migrations explicitly.
8. Connect a dedicated Instagram test account and complete all acceptance
   flows.
9. Configure the final custom-domain routes.
10. Update Meta OAuth and webhook URLs only after the test deployment passes.

## Sources

- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/)
- [Cloudflare Queues limits](https://developers.cloudflare.com/queues/platform/limits/)
- [Cloudflare Workflows pricing](https://developers.cloudflare.com/workflows/reference/pricing/)
- [Cloudflare Workflows limits](https://developers.cloudflare.com/workflows/reference/limits/)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Cloudflare Next.js on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [Neon Serverless Driver](https://neon.com/docs/serverless/serverless-driver)
- [Prisma with Neon](https://docs.prisma.io/docs/orm/v6/overview/databases/neon)
- [Neon pricing](https://neon.com/pricing)
